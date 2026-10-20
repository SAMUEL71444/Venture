<?php

use App\Models\Contract;
use App\Models\Escrow;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\Milestone;
use App\Models\Payment;
use App\Models\PaymentWebhookLog;
use App\Models\Project;
use App\Models\Refund;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Modules\payment\Gateway\MockPaymentGateway;
use App\Modules\payment\Gateway\PaymentGateway;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Fase 3 — tagihan escrow + webhook pembayaran.
 * Acuan: 05-sequence-diagram.md bagian 2, 04-state-diagram.md bagian 2 & 4, 06 bagian 3a, 07 (expire-payment).
 */
class PaymentEscrowTest extends TestCase
{
    use RefreshDatabase;

    private User $umkm;

    private User $student;

    private Project $project;

    private Contract $contract;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PlatformSettingsSeeder::class);

        $this->umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $this->student = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $category = ServiceCategory::query()->create(['name' => 'Branding', 'slug' => 'branding']);
        $this->project = Project::query()->create([
            'umkm_id' => $this->umkm->id,
            'category_id' => $category->id,
            'title' => 'Landing page',
            'description' => 'Need landing page',
            'budget_min' => 1000000,
            'budget_max' => 2000000,
            'deadline' => now()->addDays(10)->toDateString(),
            'city' => 'Bandung',
            'status' => 'ASSIGNED',
        ]);
        $this->contract = Contract::query()->create([
            'contract_no' => 'CTR-TEST-0001',
            'project_id' => $this->project->id,
            'umkm_id' => $this->umkm->id,
            'student_id' => $this->student->id,
            'total_amount' => 1000000,
            'platform_fee_pct' => 12,
            'mentor_share_pct' => 30,
            'mentor_min_fee' => 10000,
            'status' => 'AWAITING_PAYMENT',
            'payment_due_at' => now()->addHours(24),
        ]);
        Milestone::query()->create(['contract_id' => $this->contract->id, 'sequence' => 1, 'title' => 'M1', 'amount' => 1000000, 'status' => 'LOCKED']);
        Escrow::query()->create(['contract_id' => $this->contract->id, 'status' => 'PENDING_FUNDING']);
    }

    // ---------------------------------------------------------------- tagihan

    public function test_umkm_creates_escrow_payment_with_gateway_fee(): void
    {
        $payment = $this->createPayment('VA')
            ->assertCreated()
            ->assertJsonPath('data.status', 'PENDING')
            ->assertJsonPath('data.amount', 1000000)
            ->assertJsonPath('data.gateway_fee', 4000)
            ->assertJsonPath('data.total_charged', 1004000)
            ->assertJsonPath('data.gateway', 'MOCK')
            ->json('data');

        $this->assertStringStartsWith('MOCK-', $payment['gateway_ref']);
        $this->assertNotNull($payment['checkout_url']);
        $this->assertEqualsWithDelta(now()->addHours(24)->timestamp, strtotime($payment['expires_at']), 5);
        $this->assertEquals(strtotime($payment['expires_at']), $this->contract->fresh()->payment_due_at->timestamp);
        $this->assertDatabaseHas('audit_logs', ['action' => 'PAYMENT_CREATED', 'entity_id' => $payment['id']]);

        // QRIS 0,7% dari nilai project.
        Payment::query()->whereKey($payment['id'])->update(['status' => 'FAILED']);
        $this->createPayment('QRIS')->assertCreated()->assertJsonPath('data.gateway_fee', 7000);
    }

    public function test_double_click_returns_the_same_pending_payment(): void
    {
        $first = $this->createPayment('VA')->assertCreated()->json('data.id');
        $this->createPayment('VA')->assertOk()->assertJsonPath('data.id', $first);

        $this->assertSame(1, Payment::query()->count());
    }

    public function test_payment_creation_rules(): void
    {
        $this->createPayment('CASH')->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->createPayment('VA', User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']))->assertStatus(403);
        $this->createPayment('VA', $this->student)->assertStatus(403);

        $this->contract->update(['status' => 'FUNDED']);
        $this->createPayment('VA')->assertStatus(409)->assertJsonPath('error.code', 'INVALID_STATE_TRANSITION');
    }

    // ---------------------------------------------------------------- webhook

    public function test_paid_webhook_funds_escrow_with_balanced_ledger(): void
    {
        $payment = $this->pendingPayment();

        $this->webhook(['gateway_ref' => $payment->gateway_ref, 'status' => 'PAID', 'gross_amount' => 1004000])
            ->assertOk()
            ->assertJsonPath('data.status', 'PAID')
            ->assertJsonPath('data.processed', true);

        $this->assertSame('PAID', $payment->fresh()->status);
        $this->assertSame('FUNDED', $this->contract->fresh()->status);
        $this->assertNotNull($this->contract->fresh()->funded_at);

        $escrow = Escrow::query()->where('contract_id', $this->contract->id)->firstOrFail();
        $this->assertSame('HELD', $escrow->status);
        $this->assertSame(1000000, $escrow->funded_amount);
        $this->assertSame(1000000, $escrow->held_amount);
        $this->assertSame($payment->id, $escrow->payment_id);

        $transaction = LedgerTransaction::query()->where('type', 'ESCROW_FUNDED')->sole();
        $this->assertBalanced($transaction);
        $this->assertSame(1000000, $this->escrowLedgerBalance($escrow));
        $this->assertTrue(PaymentWebhookLog::query()->sole()->processed);
        $this->assertDatabaseHas('audit_logs', ['action' => 'ESCROW_FUNDED', 'entity_id' => $this->contract->id]);
    }

    public function test_duplicate_webhook_is_idempotent(): void
    {
        $payment = $this->pendingPayment();
        $body = ['gateway_ref' => $payment->gateway_ref, 'status' => 'PAID', 'gross_amount' => 1004000];

        $this->webhook($body)->assertOk()->assertJsonPath('data.processed', true);
        $this->webhook($body)->assertOk()->assertJsonPath('data.status', 'PAID')->assertJsonPath('data.processed', false);

        $this->assertSame(1, LedgerTransaction::query()->count());
        $this->assertSame(1000000, Escrow::query()->where('contract_id', $this->contract->id)->value('held_amount'));
        $this->assertSame(2, PaymentWebhookLog::query()->count());
    }

    public function test_invalid_or_missing_signature_is_rejected_with_401(): void
    {
        $payment = $this->pendingPayment();
        $raw = json_encode(['gateway_ref' => $payment->gateway_ref, 'status' => 'PAID', 'gross_amount' => 1004000]);

        $this->rawWebhook($raw, 'invalid')->assertStatus(401)->assertJsonPath('error.code', 'INVALID_SIGNATURE');
        $this->rawWebhook($raw, null)->assertStatus(401);

        // Body diubah setelah ditandatangani.
        $signature = $this->gateway()->sign($raw);
        $tampered = str_replace('1004000', '1', $raw);
        $this->rawWebhook($tampered, $signature)->assertStatus(401);

        $this->assertSame('PENDING', $payment->fresh()->status);
        $this->assertSame(0, PaymentWebhookLog::query()->count());
    }

    public function test_webhook_fails_closed_when_secret_is_not_configured(): void
    {
        $payment = $this->pendingPayment();
        $raw = json_encode(['gateway_ref' => $payment->gateway_ref, 'status' => 'PAID', 'gross_amount' => 1004000]);
        $signature = $this->gateway()->sign($raw);

        config(['services.payment_gateway.webhook_secret' => null]);
        $this->app->forgetInstance(PaymentGateway::class);

        $this->rawWebhook($raw, $signature)->assertStatus(500);
        $this->assertSame('PENDING', $payment->fresh()->status);
    }

    public function test_amount_mismatch_does_not_fund_escrow(): void
    {
        $payment = $this->pendingPayment();

        $this->webhook(['gateway_ref' => $payment->gateway_ref, 'status' => 'PAID', 'gross_amount' => 900000])
            ->assertStatus(422)
            ->assertJsonPath('error.details.expected', 1004000);

        $this->assertSame('PENDING', $payment->fresh()->status);
        $this->assertSame('AWAITING_PAYMENT', $this->contract->fresh()->status);
        $this->assertSame(0, LedgerTransaction::query()->count());
        $this->assertFalse(PaymentWebhookLog::query()->sole()->processed);
    }

    public function test_unknown_gateway_ref_is_ignored(): void
    {
        $this->webhook(['gateway_ref' => 'MOCK-UNKNOWN', 'status' => 'PAID', 'gross_amount' => 1])
            ->assertOk()
            ->assertJsonPath('data.status', 'IGNORED');

        $this->assertFalse(PaymentWebhookLog::query()->sole()->processed);
    }

    public function test_failed_payment_allows_a_new_bill(): void
    {
        $payment = $this->pendingPayment();

        $this->webhook(['gateway_ref' => $payment->gateway_ref, 'status' => 'FAILED'])
            ->assertOk()->assertJsonPath('data.status', 'FAILED');

        $this->assertSame('AWAITING_PAYMENT', $this->contract->fresh()->status);
        $this->createPayment('EWALLET')->assertCreated()->assertJsonPath('data.gateway_fee', 15000);
    }

    // ---------------------------------------------------------------- kedaluwarsa

    public function test_expired_webhook_cancels_contract_and_reopens_project(): void
    {
        $payment = $this->pendingPayment();

        $this->webhook(['gateway_ref' => $payment->gateway_ref, 'status' => 'EXPIRED'])
            ->assertOk()->assertJsonPath('data.status', 'EXPIRED');

        $this->assertSame('CANCELLED', $this->contract->fresh()->status);
        $this->assertNotNull($this->contract->fresh()->cancelled_at);
        $this->assertSame('OPEN', $this->project->fresh()->status);

        // Pembayaran terlambat setelah expired: dicatat PAID, escrow tidak didanai, nilai project di-refund otomatis.
        $this->webhook(['gateway_ref' => $payment->gateway_ref, 'status' => 'PAID', 'gross_amount' => 1004000])
            ->assertOk()->assertJsonPath('data.status', 'PAID');
        $this->assertSame('REFUNDED', $payment->fresh()->status);
        $this->assertSame(0, LedgerTransaction::query()->count());
        $this->assertDatabaseHas('refunds', ['payment_id' => $payment->id, 'amount' => 1000000, 'status' => 'SUCCESS']);
        $this->assertSame('CANCELLED', $this->contract->fresh()->status);
        $this->createPayment('VA')->assertStatus(409);

        // Webhook PAID yang sama dikirim ulang: idempotent.
        $this->webhook(['gateway_ref' => $payment->gateway_ref, 'status' => 'PAID', 'gross_amount' => 1004000])->assertOk();
        $this->assertSame(1, Refund::query()->count());
    }

    public function test_expire_job_rechecks_and_cron_expires_overdue_payments(): void
    {
        $payment = $this->pendingPayment();

        // Job dijalankan sebelum waktunya: tidak berbuat apa-apa.
        $this->artisan('payments:expire-overdue')->assertSuccessful();
        $this->assertSame('PENDING', $payment->fresh()->status);

        $this->travel(25)->hours();
        $this->artisan('payments:expire-overdue')->assertSuccessful();

        $this->assertSame('EXPIRED', $payment->fresh()->status);
        $this->assertSame('CANCELLED', $this->contract->fresh()->status);
        $this->assertSame('OPEN', $this->project->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'PAYMENT_EXPIRED', 'entity_id' => $payment->id]);
    }

    public function test_creating_payment_after_expiry_cancels_instead_of_billing_again(): void
    {
        $this->pendingPayment();
        $this->travel(25)->hours();

        $this->createPayment('VA')->assertStatus(409);
        $this->assertSame('CANCELLED', $this->contract->fresh()->status);
        $this->assertSame(1, Payment::query()->count());
    }

    public function test_mock_pay_command_simulates_gateway(): void
    {
        $payment = $this->pendingPayment();

        $this->artisan('payments:mock-pay', ['payment' => $payment->id])->assertSuccessful();

        $this->assertSame('PAID', $payment->fresh()->status);
        $this->assertSame('FUNDED', $this->contract->fresh()->status);
    }

    // ---------------------------------------------------------------- helper

    private function createPayment(string $method, ?User $user = null): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken(($user ?? $this->umkm)->createToken('test')->plainTextToken)
            ->postJson("/api/v1/contracts/{$this->contract->id}/payments", ['method' => $method]);
    }

    private function pendingPayment(): Payment
    {
        return Payment::query()->findOrFail($this->createPayment('VA')->assertCreated()->json('data.id'));
    }

    private function webhook(array $body): TestResponse
    {
        $raw = json_encode($body, JSON_THROW_ON_ERROR);

        return $this->rawWebhook($raw, $this->gateway()->sign($raw));
    }

    private function rawWebhook(string $raw, ?string $signature): TestResponse
    {
        $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'];
        if ($signature !== null) {
            $server['HTTP_X_SIGNATURE'] = $signature;
        }

        return $this->call('POST', '/api/v1/webhooks/payment-gateway', [], [], [], $server, $raw);
    }

    private function gateway(): MockPaymentGateway
    {
        return app(PaymentGateway::class);
    }

    private function assertBalanced(LedgerTransaction $transaction): void
    {
        $entries = LedgerEntry::query()->where('transaction_id', $transaction->id)->get();
        $this->assertSame(
            $entries->where('direction', 'DEBIT')->sum('amount'),
            $entries->where('direction', 'CREDIT')->sum('amount'),
        );
    }

    private function escrowLedgerBalance(Escrow $escrow): int
    {
        $entries = LedgerEntry::query()->where('escrow_id', $escrow->id)->get();

        return $entries->where('direction', 'CREDIT')->sum('amount') - $entries->where('direction', 'DEBIT')->sum('amount');
    }
}
