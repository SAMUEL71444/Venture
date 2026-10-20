<?php

namespace App\Modules\payout\Services;

use App\Models\BankAccount;
use App\Models\Payout;
use App\Models\User;
use App\Models\Wallet;
use App\Modules\ledger\Services\LedgerService;
use App\Modules\notification\Services\NotificationService;
use App\Modules\payout\Gateway\DisbursementGateway;
use App\Modules\payout\Gateway\DisbursementResult;
use App\Modules\payout\Jobs\SendDisbursementJob;
use App\Modules\payout\State\PayoutStateMachine;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidWebhookSignature;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Auth\Access\AuthorizationException;
use Throwable;

/**
 * Penarikan saldo mahasiswa & mentor (05-sequence-diagram.md bagian 5, 06 bagian 3d & 4).
 * Minimal Rp 20.000, biaya transfer ditanggung penarik, saldo dikunci saat request.
 */
final class PayoutService
{
    public const MAX_BANK_ACCOUNTS = 5;

    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly DisbursementGateway $gateway,
        private readonly PayoutStateMachine $payouts,
        private readonly LedgerService $ledger,
        private readonly PlatformSettingsService $settings,
        private readonly NotificationService $notifications,
        private readonly AuditLogger $audit,
    ) {}

    public function addBankAccount(User $user, array $input): BankAccount
    {
        $account = new BankAccount([
            'user_id' => $user->id,
            'channel' => $input['channel'],
            'provider_code' => strtoupper($input['provider_code']),
            'account_number' => $input['account_number'],
            'account_number_last4' => substr($input['account_number'], -4),
            'account_holder_name' => $input['account_holder_name'],
        ]);

        // Validasi rekening ke gateway di luar transaksi.
        $account->is_verified = $this->gateway->validateAccount($account);
        if (! $account->is_verified) {
            throw new BusinessRuleViolation('Bank account could not be verified with the disbursement provider.');
        }

        return $this->transactions->run(function () use ($user, $account, $input) {
            User::query()->lockForUpdate()->findOrFail($user->id);
            $count = BankAccount::query()->where('user_id', $user->id)->count();
            if ($count >= self::MAX_BANK_ACCOUNTS) {
                throw new BusinessRuleViolation('Maximum number of bank accounts reached.', ['max' => self::MAX_BANK_ACCOUNTS]);
            }

            $makePrimary = $count === 0 || ! empty($input['is_primary']);
            if ($makePrimary) {
                BankAccount::query()->where('user_id', $user->id)->update(['is_primary' => false]);
            }
            $account->is_primary = $makePrimary;
            $account->save();

            return $account;
        });
    }

    /** GET /wallet/withdrawals/preview — biaya transfer & jumlah bersih. */
    public function preview(User $user, int $amount, ?string $bankAccountId): array
    {
        $account = $this->ownedAccount($user, $bankAccountId, required: false);
        $channel = $account?->channel ?? 'BANK';
        $fee = $this->fee($channel);
        $wallet = $this->wallet($user);

        return [
            'amount' => $amount,
            'fee' => $fee,
            'net_amount' => $amount - $fee,
            'channel' => $channel,
            'balance' => $wallet?->balance ?? 0,
            'min_withdrawal_amount' => $this->settings->int('min_withdrawal_amount'),
            'allowed' => $this->violation($amount, $fee, $wallet?->balance ?? 0) === null,
            'reason' => $this->violation($amount, $fee, $wallet?->balance ?? 0),
        ];
    }

    /** POST /wallet/withdrawals */
    public function request(User $user, int $amount, string $bankAccountId, ?string $ip = null): Payout
    {
        $account = $this->ownedAccount($user, $bankAccountId, required: true);
        $fee = $this->fee($account->channel);

        $payout = $this->transactions->run(function () use ($user, $account, $amount, $fee, $ip) {
            $wallet = Wallet::query()->where('user_id', $user->id)->where('type', $user->role)->lockForUpdate()->first();
            $balance = $wallet?->balance ?? 0;

            if ($reason = $this->violation($amount, $fee, $balance)) {
                throw new BusinessRuleViolation($reason, ['amount' => $amount, 'fee' => $fee, 'balance' => $balance]);
            }

            $payout = Payout::query()->create([
                'wallet_id' => $wallet->id,
                'bank_account_id' => $account->id,
                'amount' => $amount,
                'fee' => $fee,
                'net_amount' => $amount - $fee,
                'status' => 'REQUESTED',
                'requested_at' => now(),
            ]);

            $this->ledger->withdraw($payout);
            SendDisbursementJob::dispatch($payout->id)->afterCommit();

            $this->audit->log($user, 'PAYOUT_REQUESTED', $payout, null, $payout->only(['amount', 'fee', 'net_amount', 'bank_account_id']), $ip);

            return $payout;
        });

        return $payout->fresh();
    }

    /** Job: kirim ke disbursement API (di luar transaksi). */
    public function send(string $payoutId): void
    {
        $payout = Payout::query()->find($payoutId);
        if (! $payout || $payout->status !== 'REQUESTED') {
            return;
        }

        try {
            $result = $this->gateway->disburse($payout, BankAccount::query()->findOrFail($payout->bank_account_id));
        } catch (Throwable $exception) {
            $result = new DisbursementResult(null, DisbursementResult::FAILED);
        }

        $this->transactions->run(function () use ($payoutId, $result) {
            $payout = Payout::query()->lockForUpdate()->findOrFail($payoutId);
            if ($payout->status !== 'REQUESTED') {
                return;
            }

            $payout->gateway_ref = $result->gatewayRef;
            match ($result->status) {
                DisbursementResult::FAILED => $this->fail($payout),
                DisbursementResult::SUCCESS => $this->succeed($payout, viaProcessing: true),
                default => $this->toProcessing($payout),
            };
        });
    }

    /** POST /webhooks/disbursement — signature atas raw body, idempotent per gateway_ref. */
    public function handleWebhook(string $rawBody, array $headers): array
    {
        if (! $this->gateway->verifyWebhook($rawBody, $headers)) {
            throw new InvalidWebhookSignature;
        }

        $event = $this->gateway->parseWebhook($rawBody);

        return $this->transactions->run(function () use ($event) {
            $payout = Payout::query()->where('gateway_ref', $event['gateway_ref'])->lockForUpdate()->first();
            if (! $payout) {
                return ['status' => 'IGNORED', 'processed' => false];
            }
            if ($payout->status !== 'PROCESSING') {
                return ['status' => $payout->status, 'processed' => false];
            }

            $event['status'] === 'SUCCESS' ? $this->succeed($payout) : $this->fail($payout);

            return ['status' => $payout->status, 'processed' => true];
        });
    }

    private function toProcessing(Payout $payout): void
    {
        $this->payouts->transition($payout, 'PROCESSING');
        $payout->save();
    }

    private function succeed(Payout $payout, bool $viaProcessing = false): void
    {
        if ($viaProcessing) {
            $this->payouts->transition($payout, 'PROCESSING');
        }
        $this->payouts->transition($payout, 'SUCCESS');
        $payout->completed_at = now();
        $payout->save();

        $this->ledger->completeWithdrawal($payout);
        $this->audit->log(null, 'PAYOUT_SUCCEEDED', $payout, null, ['gateway_ref' => $payout->gateway_ref]);
        $this->notifyOwner($payout, 'PAYOUT_SUCCESS', 'Penarikan saldo berhasil',
            'Rp '.number_format($payout->net_amount, 0, ',', '.').' sudah dikirim ke rekening Anda (biaya transfer Rp '.number_format($payout->fee, 0, ',', '.').').');
    }

    private function fail(Payout $payout): void
    {
        $this->payouts->transition($payout, 'FAILED');
        $payout->completed_at = now();
        $payout->save();

        $this->ledger->reverseWithdrawal($payout);
        $this->audit->log(null, 'PAYOUT_FAILED', $payout, null, ['gateway_ref' => $payout->gateway_ref]);
        $this->notifyOwner($payout, 'PAYOUT_FAILED', 'Penarikan saldo gagal',
            'Penarikan Rp '.number_format($payout->amount, 0, ',', '.').' gagal diproses. Saldo sudah dikembalikan ke wallet Anda.');
    }

    private function violation(int $amount, int $fee, int $balance): ?string
    {
        $min = $this->settings->int('min_withdrawal_amount');

        return match (true) {
            $amount < $min => "Minimum withdrawal is Rp {$min}.",
            $amount - $fee <= 0 => 'Withdrawal amount must be greater than the transfer fee.',
            $amount > $balance => 'Insufficient wallet balance.',
            default => null,
        };
    }

    /** withdrawal_fee di platform_settings jika diisi; jika kosong mengikuti tarif gateway (README). */
    private function fee(string $channel): int
    {
        $setting = $this->settings->get('withdrawal_fee');

        return $setting !== null ? (int) $setting : $this->gateway->quoteFee($channel);
    }

    private function wallet(User $user): ?Wallet
    {
        return Wallet::query()->where('user_id', $user->id)->where('type', $user->role)->first();
    }

    private function ownedAccount(User $user, ?string $bankAccountId, bool $required): ?BankAccount
    {
        $account = $bankAccountId
            ? BankAccount::query()->whereKey($bankAccountId)->first()
            : BankAccount::query()->where('user_id', $user->id)->where('is_primary', true)->first();

        if ($bankAccountId && $account && $account->user_id !== $user->id) {
            throw new AuthorizationException('This bank account does not belong to you.');
        }
        if ($required && (! $account || ! $account->is_verified)) {
            throw new BusinessRuleViolation('A verified bank account is required.');
        }

        return $account;
    }

    private function notifyOwner(Payout $payout, string $type, string $title, string $body): void
    {
        $userId = Wallet::query()->whereKey($payout->wallet_id)->value('user_id');
        $this->notifications->notify(User::query()->find($userId), $type, $title, $body, ['payout_id' => $payout->id]);
    }
}
