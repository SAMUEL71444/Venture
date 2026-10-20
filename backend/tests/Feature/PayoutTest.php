<?php

use App\Models\BankAccount;
use App\Models\LedgerTransaction;
use App\Models\Payout;
use App\Models\PlatformSetting;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\Wallet;
use App\Modules\payout\Gateway\DisbursementGateway;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Feature\Concerns\BuildsContracts;
use Tests\TestCase;

/**
 * Fase 7 — penarikan saldo.
 * Acuan: 05-sequence-diagram.md bagian 5, 04-state-diagram.md bagian 6, 06-alur-keuangan-escrow.md bagian 3d & 4.
 */
class PayoutTest extends TestCase
{
    use BuildsContracts, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpParties();

        // Saldo mahasiswa 352.000 dan mentor 14.400 dari milestone 400.000 yang dicairkan.
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'APPROVED'], [600000, 'IN_PROGRESS']]);
        $this->releaseMilestone($contract, $this->milestoneOf($contract, 1));
    }

    public function test_bank_accounts_are_stored_encrypted_and_masked(): void
    {
        $first = $this->addAccount($this->student)->assertCreated()
            ->assertJsonPath('data.account_number_last4', '7890')
            ->assertJsonPath('data.is_primary', true)
            ->assertJsonPath('data.is_verified', true)
            ->assertJsonMissingPath('data.account_number')
            ->json('data');

        $raw = DB::table('bank_accounts')->where('id', $first['id'])->value('account_number');
        $this->assertNotSame('1234567890', $raw);
        $this->assertSame('1234567890', BankAccount::query()->find($first['id'])->account_number);

        $this->addAccount($this->student, ['channel' => 'EWALLET', 'provider_code' => 'DANA', 'account_number' => '081234567891', 'is_primary' => true])
            ->assertCreated()->assertJsonPath('data.is_primary', true);
        $this->assertFalse(BankAccount::query()->find($first['id'])->is_primary);

        $this->addAccount($this->student, ['provider_code' => 'DANA'])->assertStatus(422); // DANA bukan kanal BANK
        $this->addAccount($this->student, ['account_number' => '12ab'])->assertStatus(422);
        $this->addAccount($this->umkm)->assertStatus(403);

        $this->actingWith($this->student)->getJson('/api/v1/bank-accounts')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonMissingPath('data.0.account_number');
    }

    public function test_preview_shows_fee_and_net_amount(): void
    {
        $this->actingWith($this->student)->getJson('/api/v1/wallet/withdrawals/preview?amount=30000')
            ->assertOk()
            ->assertJsonPath('data.fee', 2500)
            ->assertJsonPath('data.net_amount', 27500)
            ->assertJsonPath('data.allowed', true)
            ->assertJsonPath('data.balance', 352000);

        $this->actingWith($this->student)->getJson('/api/v1/wallet/withdrawals/preview?amount=19999')
            ->assertOk()->assertJsonPath('data.allowed', false);
    }

    public function test_successful_withdrawal_locks_balance_then_completes(): void
    {
        $accountId = $this->addAccount($this->student)->json('data.id');

        $payout = $this->withdraw($this->student, 352000, $accountId)->assertCreated()
            ->assertJsonPath('data.amount', 352000)
            ->assertJsonPath('data.fee', 2500)
            ->assertJsonPath('data.net_amount', 349500)
            ->assertJsonPath('data.status', 'PROCESSING')
            ->json('data');

        $wallet = Wallet::query()->where('user_id', $this->student->id)->where('type', 'STUDENT')->sole();
        $this->assertSame([0, 352000], [$wallet->balance, $wallet->pending_withdrawal]);

        // Jurnal 06 bagian 3d.
        $entries = LedgerTransaction::query()->where('idempotency_key', "payout:{$payout['id']}:withdraw")->sole()->entries()->get()
            ->map(fn ($e) => [$e->account_type, $e->direction, $e->amount])->all();
        $this->assertEqualsCanonicalizing([['WALLET', 'DEBIT', 352000], ['PAYOUT_CLEARING', 'CREDIT', 349500], ['TRANSFER_FEE_PAYABLE', 'CREDIT', 2500]], $entries);

        $this->disbursementWebhook($payout['gateway_ref'], 'SUCCESS')->assertOk()->assertJsonPath('data.status', 'SUCCESS');
        $this->disbursementWebhook($payout['gateway_ref'], 'FAILED')->assertOk()->assertJsonPath('data.processed', false);

        $wallet->refresh();
        $this->assertSame([0, 0], [$wallet->balance, $wallet->pending_withdrawal]);
        $this->assertSame('SUCCESS', Payout::query()->find($payout['id'])->status);
        $this->assertStringContainsString('349.500', UserNotification::query()->where('type', 'PAYOUT_SUCCESS')->value('body'));
        $this->assertLedgerReconciles();
    }

    public function test_failed_disbursement_returns_the_balance(): void
    {
        // Saldo mentor 14.400 di bawah minimum penarikan.
        $mentorAccount = $this->addAccount($this->mentor)->json('data.id');
        $this->withdraw($this->mentor, 14400, $mentorAccount)->assertStatus(422);

        $accountId = $this->addAccount($this->student)->json('data.id');
        $payout = $this->withdraw($this->student, 30000, $accountId)->assertCreated()->json('data');

        $this->disbursementWebhook($payout['gateway_ref'], 'FAILED')->assertOk()->assertJsonPath('data.status', 'FAILED');

        $wallet = Wallet::query()->where('user_id', $this->student->id)->where('type', 'STUDENT')->sole();
        $this->assertSame([352000, 0], [$wallet->balance, $wallet->pending_withdrawal]);
        $this->assertSame(1, LedgerTransaction::query()->where('idempotency_key', "payout:{$payout['id']}:reversal")->count());
        $this->assertLedgerReconciles();
    }

    public function test_withdrawal_rules(): void
    {
        $accountId = $this->addAccount($this->student)->json('data.id');
        $otherAccount = $this->addAccount($this->mentor)->json('data.id');

        $this->withdraw($this->student, 19999, $accountId)->assertStatus(422)->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');
        $this->withdraw($this->student, 352001, $accountId)->assertStatus(422);
        $this->withdraw($this->student, 50000, $otherAccount)->assertStatus(403);
        $this->withdraw($this->umkm, 50000, $accountId)->assertStatus(403);

        $this->withdraw($this->student, 300000, $accountId)->assertCreated();
        $this->withdraw($this->student, 60000, $accountId)->assertStatus(422); // sisa saldo 52.000
        $this->assertSame(1, Payout::query()->count());
    }

    public function test_withdrawal_fee_setting_overrides_gateway_tariff(): void
    {
        PlatformSetting::query()->whereKey('withdrawal_fee')->update(['value' => json_encode(5000)]);
        app(PlatformSettingsService::class)->clearCache();
        $accountId = $this->addAccount($this->student)->json('data.id');

        $this->withdraw($this->student, 20000, $accountId)->assertCreated()->assertJsonPath('data.fee', 5000)->assertJsonPath('data.net_amount', 15000);
    }

    public function test_disbursement_webhook_requires_valid_signature(): void
    {
        $raw = json_encode(['gateway_ref' => 'MOCK-DS-X', 'status' => 'SUCCESS']);

        $this->call('POST', '/api/v1/webhooks/disbursement', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_SIGNATURE' => 'bad',
        ], $raw)->assertStatus(401);
    }

    private function addAccount(User $user, array $overrides = []): TestResponse
    {
        return $this->actingWith($user)->postJson('/api/v1/bank-accounts', [
            'channel' => 'BANK', 'provider_code' => 'BCA', 'account_number' => '1234567890', 'account_holder_name' => 'Nama Pemilik', ...$overrides,
        ]);
    }

    private function withdraw(User $user, int $amount, string $accountId): TestResponse
    {
        return $this->actingWith($user)->postJson('/api/v1/wallet/withdrawals', ['amount' => $amount, 'bank_account_id' => $accountId]);
    }

    private function disbursementWebhook(string $ref, string $status): TestResponse
    {
        $raw = json_encode(['gateway_ref' => $ref, 'status' => $status]);

        return $this->call('POST', '/api/v1/webhooks/disbursement', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_SIGNATURE' => app(DisbursementGateway::class)->sign($raw),
        ], $raw);
    }
}
