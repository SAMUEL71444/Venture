<?php

use App\Models\AdminAlert;
use App\Models\CancellationRequest;
use App\Models\Escrow;
use App\Models\LedgerTransaction;
use App\Models\MilestoneSettlement;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Feature\Concerns\BuildsContracts;
use Tests\TestCase;

/**
 * Fase 6 — pembatalan.
 * Acuan: 04-state-diagram.md bagian 2 & 5, 05-sequence-diagram.md bagian 4, 06-alur-keuangan-escrow.md bagian 3c & 4.
 */
class CancellationTest extends TestCase
{
    use BuildsContracts, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpParties();
    }

    // ---------------------------------------------------------------- batal langsung

    public function test_umkm_cancels_awaiting_payment_contract_directly(): void
    {
        $contract = $this->makeContract('AWAITING_PAYMENT', [[400000, 'LOCKED']], funded: false);

        $this->cancel($contract, $this->umkm)
            ->assertCreated()
            ->assertJsonPath('data.type', 'DIRECT')
            ->assertJsonPath('data.status', 'APPROVED');

        $this->assertSame('CANCELLED', $contract->fresh()->status);
        $this->assertSame($this->umkm->id, $contract->fresh()->cancelled_by);
        $this->assertSame('EXPIRED', Payment::query()->where('reference_id', $contract->id)->value('status'));
        $this->assertSame('CANCELLED', $this->project->fresh()->status);
        $this->assertSame(1, UserNotification::query()->where('user_id', $this->student->id)->where('type', 'CONTRACT_CANCELLED')->count());
    }

    public function test_umkm_can_reopen_project_when_cancelling_before_work(): void
    {
        $contract = $this->makeContract('AWAITING_PAYMENT', [[400000, 'LOCKED']], funded: false);

        $this->cancel($contract, $this->umkm, ['reopen_project' => true])->assertCreated();

        $this->assertSame('OPEN', $this->project->fresh()->status);
    }

    public function test_student_cancels_funded_contract_and_project_value_is_refunded(): void
    {
        $contract = $this->makeContract('FUNDED', [[400000, 'LOCKED'], [600000, 'LOCKED']]);
        $payment = Payment::query()->where('reference_id', $contract->id)->sole();

        $this->cancel($contract, $this->student)->assertCreated()->assertJsonPath('data.type', 'DIRECT');

        $this->assertSame('CANCELLED', $contract->fresh()->status);
        // Mahasiswa membatalkan -> project dibuka ulang (README 11).
        $this->assertSame('OPEN', $this->project->fresh()->status);

        $escrow = Escrow::query()->where('contract_id', $contract->id)->sole();
        $this->assertSame(['REFUNDED', 0, 1000000], [$escrow->status, $escrow->held_amount, $escrow->refunded_amount]);

        // Nilai project dikembalikan; biaya gateway (4.000) tidak.
        $refund = Refund::query()->sole();
        $this->assertSame([1000000, 'SUCCESS'], [$refund->amount, $refund->status]);
        $this->assertSame('REFUNDED', $payment->fresh()->status);
        $this->assertSame(0, $this->balance($this->umkm->id, 'UMKM_REFUND'));
        $this->assertSame(2, LedgerTransaction::query()->where('type', 'REFUND')->count());
        $this->assertLedgerReconciles();
    }

    public function test_finished_contracts_cannot_be_cancelled(): void
    {
        $contract = $this->makeContract('COMPLETED', [[400000, 'APPROVED']]);

        $this->cancel($contract, $this->umkm)->assertStatus(409);
        $this->cancel($contract, User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']))->assertStatus(403);
        $this->actingWith($this->mentor)->postJson("/api/v1/contracts/{$contract->id}/cancellations", ['reason' => 'x'])->assertStatus(403);
    }

    // ---------------------------------------------------------------- pengajuan (IN_PROGRESS)

    public function test_in_progress_cancellation_needs_review_and_freezes_work(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'IN_PROGRESS']]);

        $request = $this->cancel($contract, $this->umkm, ['evidence_urls' => ['https://example.com/bukti.png']])
            ->assertCreated()
            ->assertJsonPath('data.type', 'NEEDS_REVIEW')
            ->assertJsonPath('data.status', 'PENDING')
            ->json('data');

        $this->assertSame('CANCELLATION_REQUESTED', $contract->fresh()->status);
        $this->assertDatabaseHas('admin_alerts', ['type' => 'CANCELLATION_REQUEST', 'reference_id' => $request['id'], 'status' => 'OPEN']);
        $this->assertSame(1, UserNotification::query()->where('user_id', $this->student->id)->where('type', 'CANCELLATION_REQUESTED')->count());
        $this->assertSame(1, UserNotification::query()->where('user_id', $this->admin->id)->count());

        // Aksi milestone dibekukan.
        $this->actingWith($this->student)->post("/api/v1/milestones/{$this->milestoneOf($contract, 1)->id}/submissions", [
            'files' => [UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertStatus(409);

        // Pengajuan kedua -> 409.
        $this->cancel($contract, $this->student)->assertStatus(409);

        // Tanggapan pihak lain: sekali; pengaju & orang luar ditolak.
        $this->actingWith($this->umkm)->postJson("/api/v1/cancellations/{$request['id']}/responses", ['response' => 'x'])->assertStatus(403);
        $this->actingWith(User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']))
            ->postJson("/api/v1/cancellations/{$request['id']}/responses", ['response' => 'x'])->assertStatus(403);
        $this->actingWith($this->student)->postJson("/api/v1/cancellations/{$request['id']}/responses", ['response' => 'Saya keberatan'])
            ->assertOk()->assertJsonPath('data.counterparty_response', 'Saya keberatan');
        $this->actingWith($this->student)->postJson("/api/v1/cancellations/{$request['id']}/responses", ['response' => 'lagi'])->assertStatus(409);
    }

    public function test_admin_waits_for_response_or_deadline_before_deciding(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'IN_PROGRESS']]);
        $requestId = $this->cancel($contract, $this->umkm)->json('data.id');

        $this->actingWith($this->admin)->postJson("/api/v1/admin/cancellations/{$requestId}/reject", ['admin_notes' => 'x'])
            ->assertStatus(422)->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');

        // Batas tanggapan 3 hari lewat -> alert AWAITING_DECISION, admin boleh memutuskan.
        $this->travel(3)->days();
        $this->artisan('scheduler:sweep')->assertSuccessful();
        $this->assertSame('AWAITING_DECISION', AdminAlert::query()->where('type', 'CANCELLATION_REQUEST')->value('status'));

        $this->actingWith($this->admin)->postJson("/api/v1/admin/cancellations/{$requestId}/reject", ['admin_notes' => 'Bukti kurang'])
            ->assertOk()->assertJsonPath('data.status', 'REJECTED');
        $this->assertSame('IN_PROGRESS', $contract->fresh()->status);
        $this->assertSame('RESOLVED', AdminAlert::query()->where('type', 'CANCELLATION_REQUEST')->value('status'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'CANCELLATION_REJECTED', 'entity_id' => $requestId]);
    }

    public function test_approval_allocates_per_milestone_with_commission_and_mentor_fee(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'APPROVED'], [600000, 'MENTOR_REVIEW']]);
        $this->releaseMilestone($contract, $this->milestoneOf($contract, 1));
        $second = $this->milestoneOf($contract, 2);
        $this->assignMentor($second, $this->mentor, eligible: true);

        $requestId = $this->cancel($contract, $this->umkm)->json('data.id');
        $this->actingWith($this->student)->postJson("/api/v1/cancellations/{$requestId}/responses", ['response' => 'Setuju sebagian']);

        $approve = fn (array $allocations) => $this->actingWith($this->admin)
            ->postJson("/api/v1/admin/cancellations/{$requestId}/approve", ['allocations' => $allocations, 'admin_notes' => 'Dibagi']);

        // Milestone yang sudah dicairkan tidak boleh dialokasikan; nominal harus pas.
        $approve([])->assertStatus(422)->assertJsonPath('error.details.missing_milestone_ids.0', $second->id);
        $approve([['milestone_id' => $this->milestoneOf($contract, 1)->id, 'amount_to_student' => 400000, 'amount_to_umkm' => 0]])->assertStatus(422);
        $approve([['milestone_id' => $second->id, 'amount_to_student' => 200000, 'amount_to_umkm' => 300000]])->assertStatus(422);

        $approve([['milestone_id' => $second->id, 'amount_to_student' => 200000, 'amount_to_umkm' => 400000]])
            ->assertOk()->assertJsonPath('data.status', 'APPROVED')->assertJsonCount(1, 'data.allocations');

        // Komisi 12% dari bagian mahasiswa = 24.000; fee mentor dari nilai penuh 600.000 = 21.600.
        $settlement = MilestoneSettlement::query()->where('milestone_id', $second->id)->sole();
        $this->assertSame([24000, 21600, 2400, 176000, 400000], [
            $settlement->platform_fee, $settlement->mentor_fee, $settlement->platform_net, $settlement->student_amount, $settlement->refund_amount,
        ]);
        $this->assertSame(352000 + 176000, $this->balance($this->student->id, 'STUDENT'));
        $this->assertSame(14400 + 21600, $this->balance($this->mentor->id, 'MENTOR'));
        $this->assertSame(33600 + 2400, $this->balance(null, 'PLATFORM_REVENUE'));

        $escrow = Escrow::query()->where('contract_id', $contract->id)->sole();
        $this->assertSame(['SETTLED', 0, 600000, 400000], [$escrow->status, $escrow->held_amount, $escrow->released_amount, $escrow->refunded_amount]);
        $this->assertSame('TERMINATED', $contract->fresh()->status);
        $this->assertSame('CANCELLED', $second->fresh()->status);
        $this->assertSame('CANCELLED', $this->project->fresh()->status);

        // Refund sebagian: payment tetap PAID.
        $this->assertSame([400000, 'SUCCESS'], [Refund::query()->sole()->amount, Refund::query()->sole()->status]);
        $this->assertSame('PAID', Payment::query()->where('reference_id', $contract->id)->value('status'));
        $this->assertSame(0, $this->balance($this->umkm->id, 'UMKM_REFUND'));
        $this->assertLedgerReconciles();

        $approve([['milestone_id' => $second->id, 'amount_to_student' => 0, 'amount_to_umkm' => 600000]])->assertStatus(409);
    }

    public function test_full_refund_still_pays_mentor_from_platform(): void
    {
        // Contoh jurnal 06 bagian 3c.
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'APPROVED'], [600000, 'IN_PROGRESS']]);
        $this->releaseMilestone($contract, $this->milestoneOf($contract, 1));
        $second = $this->milestoneOf($contract, 2);
        $this->assignMentor($second, $this->mentor, eligible: true);

        $this->actingWith($this->admin)->postJson("/api/v1/admin/contracts/{$contract->id}/terminate", [
            'allocations' => [['milestone_id' => $second->id, 'amount_to_student' => 0, 'amount_to_umkm' => 600000]],
            'admin_notes' => 'UMKM tidak merespons, dana dikembalikan',
        ])->assertCreated()->assertJsonPath('data.requester_role', 'ADMIN');

        $refundTransaction = LedgerTransaction::query()->where('idempotency_key', "milestone:{$second->id}:termination-refund")->sole();
        $entries = $refundTransaction->entries()->get()->map(fn ($e) => [$e->account_type, $e->direction, $e->amount])->sortBy(fn ($e) => implode($e))->values()->all();
        $this->assertEqualsCanonicalizing([
            ['ESCROW', 'DEBIT', 600000],
            ['WALLET', 'CREDIT', 600000],
            ['WALLET', 'DEBIT', 21600],
            ['WALLET', 'CREDIT', 21600],
        ], $entries);
        $this->assertSame(33600 - 21600, $this->balance(null, 'PLATFORM_REVENUE'));
        $this->assertSame('TERMINATED', $contract->fresh()->status);
        $this->assertLedgerReconciles();

        $this->actingWith($this->admin)->postJson("/api/v1/admin/contracts/{$contract->id}/terminate", ['allocations' => [], 'admin_notes' => 'x'])->assertStatus(409);
    }

    public function test_withdraw_resumes_work_and_shifts_review_timer(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'CLIENT_REVIEW']]);
        $milestone = $this->milestoneOf($contract, 1);
        $milestone->update(['client_review_started_at' => now()]);

        $this->travel(2)->days();
        $requestId = $this->cancel($contract, $this->student)->json('data.id');

        $this->actingWith($this->umkm)->postJson("/api/v1/cancellations/{$requestId}/withdraw")->assertStatus(403);

        $this->travel(3)->days(); // jeda 3 hari, hari ke-5 siklus review
        $this->actingWith($this->student)->postJson("/api/v1/cancellations/{$requestId}/withdraw")
            ->assertOk()->assertJsonPath('data.status', 'WITHDRAWN');
        $this->assertSame('IN_PROGRESS', $contract->fresh()->status);
        $this->assertSame(3 * 86400, $milestone->fresh()->client_review_paused_seconds);

        // Reminder H+3 bergeser ke hari ke-6.
        $this->artisan('scheduler:sweep');
        $this->assertSame(0, UserNotification::query()->where('type', 'REVIEW_REMINDER')->count());
        $this->travel(1)->days();
        $this->artisan('scheduler:sweep');
        $this->assertSame(1, UserNotification::query()->where('type', 'REVIEW_REMINDER')->count());

        $this->actingWith($this->student)->postJson("/api/v1/cancellations/{$requestId}/withdraw")->assertStatus(409);
        $this->assertSame('WITHDRAWN', CancellationRequest::query()->find($requestId)->status);
    }

    private function cancel($contract, User $user, array $extra = [])
    {
        return $this->actingWith($user)->postJson("/api/v1/contracts/{$contract->id}/cancellations", ['reason' => 'Alasan pembatalan', ...$extra]);
    }
}
