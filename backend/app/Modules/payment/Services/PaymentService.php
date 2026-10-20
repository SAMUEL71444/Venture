<?php

namespace App\Modules\payment\Services;

use App\Models\Contract;
use App\Models\Escrow;
use App\Models\Payment;
use App\Models\PaymentWebhookLog;
use App\Models\Project;
use App\Models\User;
use App\Modules\contract\State\ContractStateMachine;
use App\Modules\ledger\Services\LedgerService;
use App\Modules\notification\Services\NotificationService;
use App\Modules\payment\Gateway\GatewayEvent;
use App\Modules\payment\Gateway\PaymentGateway;
use App\Modules\payment\Jobs\ExpirePaymentJob;
use App\Modules\payment\State\PaymentStateMachine;
use App\Modules\project\Services\PremiumListingService;
use App\Modules\project\State\ProjectStateMachine;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use App\Shared\Exceptions\InvalidWebhookSignature;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Auth\Access\AuthorizationException;
use Throwable;

/**
 * Pembayaran escrow (05-sequence-diagram.md bagian 2). Urutan lock di semua alur:
 * contract -> payment -> escrow -> wallet, supaya tagihan, webhook, dan expiry tidak deadlock.
 */
final class PaymentService
{
    public const METHODS = ['VA', 'QRIS', 'EWALLET'];

    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly PaymentGateway $gateway,
        private readonly PaymentStateMachine $payments,
        private readonly ContractStateMachine $contracts,
        private readonly ProjectStateMachine $projects,
        private readonly LedgerService $ledger,
        private readonly PlatformSettingsService $settings,
        private readonly AuditLogger $audit,
        private readonly SchedulerPlanner $scheduler,
        private readonly NotificationService $notifications,
        private readonly RefundService $refunds,
        private readonly PremiumListingService $premium,
    ) {}

    /**
     * POST /contracts/{id}/payments. Jika masih ada tagihan PENDING yang belum kedaluwarsa,
     * tagihan itu yang dikembalikan (idempotent untuk double click).
     *
     * @return array{payment: Payment, created: bool}
     */
    public function createEscrowPayment(Contract $contract, User $umkm, string $method, ?string $ip = null): array
    {
        if ($contract->umkm_id !== $umkm->id) {
            throw new AuthorizationException('Only the project owner can pay for this contract.');
        }

        $this->expireOverdueForContract($contract->id);

        $result = $this->transactions->run(function () use ($contract, $umkm, $method) {
            $contract = Contract::query()->lockForUpdate()->findOrFail($contract->id);
            if ($contract->status !== 'AWAITING_PAYMENT') {
                throw new InvalidStateTransition('Only contracts awaiting payment can be paid.', ['status' => $contract->status]);
            }

            $pending = Payment::query()
                ->where('reference_type', 'CONTRACT')
                ->where('reference_id', $contract->id)
                ->where('purpose', 'ESCROW_FUNDING')
                ->where('status', 'PENDING')
                ->lockForUpdate()
                ->first();
            if ($pending) {
                return ['payment' => $pending, 'created' => false];
            }

            $expiresAt = now()->addHours($this->settings->int('payment_expiry_hours'));
            $payment = Payment::query()->create([
                'payer_id' => $umkm->id,
                'purpose' => 'ESCROW_FUNDING',
                'reference_type' => 'CONTRACT',
                'reference_id' => $contract->id,
                'amount' => $contract->total_amount,
                // Biaya layanan pembayaran ditanggung UMKM, tidak masuk escrow.
                'gateway_fee' => $this->gateway->quoteFee($contract->total_amount, $method),
                'gateway' => $this->gateway->name(),
                'method' => $method,
                'status' => 'PENDING',
                'expires_at' => $expiresAt,
            ]);

            $contract->payment_due_at = $expiresAt;
            $contract->save();

            return ['payment' => $payment, 'created' => true];
        });

        $payment = $result['payment'];
        if (! $result['created']) {
            return $result;
        }

        // Panggilan ke gateway di luar transaksi agar lock kontrak tidak tertahan oleh I/O jaringan.
        try {
            $charge = $this->gateway->createCharge($payment);
        } catch (Throwable $exception) {
            $this->transactions->run(function () use ($payment) {
                $locked = Payment::query()->lockForUpdate()->findOrFail($payment->id);
                if ($locked->status === 'PENDING') {
                    $this->payments->transition($locked, 'FAILED');
                    $locked->save();
                }
            });

            throw $exception;
        }

        $payment->forceFill(['gateway_ref' => $charge->gatewayRef, 'checkout_url' => $charge->checkoutUrl])->save();

        $this->audit->log($umkm, 'PAYMENT_CREATED', $payment, null, [
            'contract_id' => $contract->id,
            'amount' => $payment->amount,
            'gateway_fee' => $payment->gateway_fee,
            'gateway_ref' => $payment->gateway_ref,
        ], $ip);

        ExpirePaymentJob::dispatch($payment->id)->delay($payment->expires_at);

        return ['payment' => $payment->fresh(), 'created' => true];
    }

    /**
     * POST /webhooks/payment-gateway. Verifikasi signature atas raw body, simpan log,
     * lalu proses idempotent berdasarkan gateway_ref.
     *
     * @return array{status: string, processed: bool}
     */
    public function handleWebhook(string $rawBody, array $headers): array
    {
        if (! $this->gateway->verifyWebhook($rawBody, $headers)) {
            throw new InvalidWebhookSignature;
        }

        $event = $this->gateway->parseWebhook($rawBody);

        // Log disimpan di luar transaksi pemrosesan supaya tetap ada walau pemrosesan gagal.
        $log = PaymentWebhookLog::query()->create([
            'gateway' => $this->gateway->name(),
            'gateway_ref' => $event->gatewayRef,
            'event_type' => $event->eventType,
            'payload' => $event->payload,
            'processed' => false,
            'received_at' => now(),
        ]);

        $known = Payment::query()->where('gateway_ref', $event->gatewayRef)->first();

        if ($known?->reference_type === 'PREMIUM_LISTING') {
            return $this->transactions->run(function () use ($known, $event, $log) {
                $before = $known->status;
                $status = $this->premium->handlePaymentEvent($known, $event);
                $log->forceFill(['processed' => true])->save();

                return ['status' => $status, 'processed' => $status !== $before];
            });
        }

        $contractId = $known?->reference_type === 'CONTRACT' ? $known->reference_id : null;

        if (! $contractId) {
            return ['status' => 'IGNORED', 'processed' => false];
        }

        return $this->transactions->run(function () use ($event, $contractId, $log) {
            $contract = Contract::query()->lockForUpdate()->findOrFail($contractId);
            $payment = Payment::query()->where('gateway_ref', $event->gatewayRef)->lockForUpdate()->firstOrFail();

            // Uang benar-benar masuk setelah tagihan kami anggap EXPIRED/FAILED: wajib dicatat lalu
            // di-refund (atau mendanai escrow jika kontrak masih menunggu pembayaran).
            $latePayment = $event->status === GatewayEvent::PAID && in_array($payment->status, ['EXPIRED', 'FAILED'], true);

            if ($payment->status !== 'PENDING' && ! $latePayment) {
                // Webhook ganda / terlambat: tidak ada perubahan (idempotent).
                $log->forceFill(['processed' => true])->save();

                return ['status' => $payment->status, 'processed' => false];
            }

            match ($event->status) {
                GatewayEvent::PAID => $this->markPaid($contract, $payment, $event),
                GatewayEvent::FAILED => $this->markFailed($payment),
                GatewayEvent::EXPIRED => $this->markExpired($contract, $payment),
                default => null,
            };

            $log->forceFill(['processed' => true])->save();

            return ['status' => $payment->status, 'processed' => $payment->status !== 'PENDING'];
        });
    }

    /** Job expire-payment: cek ulang status sebelum bertindak (07 bagian 1). */
    public function expire(string $paymentId): void
    {
        if (Payment::query()->whereKey($paymentId)->value('reference_type') === 'PREMIUM_LISTING') {
            $this->premium->expirePayment($paymentId);

            return;
        }

        $contractId = Payment::query()->whereKey($paymentId)->where('reference_type', 'CONTRACT')->value('reference_id');
        if (! $contractId) {
            return;
        }

        $this->transactions->run(function () use ($paymentId, $contractId) {
            $contract = Contract::query()->lockForUpdate()->find($contractId);
            $payment = Payment::query()->lockForUpdate()->find($paymentId);

            if (! $contract || ! $payment || $payment->status !== 'PENDING' || $payment->expires_at->isFuture()) {
                return;
            }

            $this->markExpired($contract, $payment);
        });
    }

    private function markPaid(Contract $contract, Payment $payment, GatewayEvent $event): void
    {
        if ($event->grossAmount !== $payment->total_charged) {
            // Nominal tidak cocok: jangan danai escrow. Log tetap unprocessed untuk ditinjau.
            throw new BusinessRuleViolation('Paid amount does not match the payment.', [
                'gross_amount' => $event->grossAmount,
                'expected' => $payment->total_charged,
            ]);
        }

        $this->payments->transition($payment, 'PAID');
        $payment->paid_at = now();
        $payment->save();

        if ($contract->status !== 'AWAITING_PAYMENT') {
            // Dibayar setelah kontrak batal (misal tagihan sudah expired): escrow tidak didanai,
            // nilai project otomatis di-refund (biaya gateway tidak dikembalikan).
            $this->audit->log(null, 'PAYMENT_RECEIVED_FOR_INACTIVE_CONTRACT', $payment, null, [
                'contract_id' => $contract->id,
                'contract_status' => $contract->status,
                'amount' => $payment->amount,
            ]);
            $this->refunds->request($payment, $payment->amount, null, fromPayable: false);

            return;
        }

        $escrow = Escrow::query()->where('contract_id', $contract->id)->first()
            ?? Escrow::query()->createOrFirst(['contract_id' => $contract->id], ['status' => 'PENDING_FUNDING']);

        $transaction = $this->ledger->fundEscrow($escrow, $payment);

        $this->contracts->transition($contract, 'FUNDED');
        $contract->funded_at = now();
        $contract->save();

        // Reminder Mulai Kerja 24/72 jam + cek hari ke-7 (tidak ada auto-start).
        $this->scheduler->contractFunded($contract);
        $this->notifications->notify(
            User::query()->whereIn('id', [$contract->umkm_id, $contract->student_id])->get(),
            'PAYMENT_SUCCESS', 'Pembayaran berhasil',
            "Dana kontrak {$contract->contract_no} sudah aman di escrow.",
            ['contract_id' => $contract->id], [NotificationService::WHATSAPP],
        );

        $this->audit->log(null, 'ESCROW_FUNDED', $contract, ['status' => 'AWAITING_PAYMENT'], [
            'status' => $contract->status,
            'payment_id' => $payment->id,
            'amount' => $payment->amount,
            'ledger_transaction_id' => $transaction->id,
        ]);
    }

    private function markFailed(Payment $payment): void
    {
        // Kontrak tetap AWAITING_PAYMENT; UMKM bisa membuat tagihan baru.
        $this->payments->transition($payment, 'FAILED');
        $payment->save();
    }

    /** Tagihan expired: payment EXPIRED, kontrak CANCELLED, project kembali OPEN. */
    private function markExpired(Contract $contract, Payment $payment): void
    {
        $this->payments->transition($payment, 'EXPIRED');
        $payment->save();

        if ($contract->status !== 'AWAITING_PAYMENT') {
            return;
        }

        $this->contracts->transition($contract, 'CANCELLED');
        $contract->cancelled_at = now();
        $contract->save();

        $project = Project::query()->lockForUpdate()->find($contract->project_id);
        if ($project && $project->status === 'ASSIGNED') {
            $this->projects->transition($project, 'OPEN');
            $project->save();
        }

        $this->notifications->notify(
            User::query()->whereIn('id', [$contract->umkm_id, $contract->student_id])->get(),
            'PAYMENT_EXPIRED', 'Tagihan kedaluwarsa',
            "Tagihan kontrak {$contract->contract_no} tidak dibayar tepat waktu sehingga kontrak dibatalkan.",
            ['contract_id' => $contract->id], [NotificationService::WHATSAPP],
        );

        $this->audit->log(null, 'PAYMENT_EXPIRED', $payment, ['status' => 'PENDING'], [
            'status' => 'EXPIRED',
            'contract_id' => $contract->id,
            'contract_status' => $contract->status,
        ]);
    }

    private function expireOverdueForContract(string $contractId): void
    {
        Payment::query()
            ->where('reference_type', 'CONTRACT')
            ->where('reference_id', $contractId)
            ->where('status', 'PENDING')
            ->where('expires_at', '<=', now())
            ->pluck('id')
            ->each(fn (string $paymentId) => $this->expire($paymentId));
    }
}
