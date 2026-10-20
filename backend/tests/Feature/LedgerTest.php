<?php

use App\Models\Contract;
use App\Models\Escrow;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\MentorAssignment;
use App\Models\Milestone;
use App\Models\MilestoneSettlement;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\Wallet;
use App\Modules\ledger\Services\LedgerService;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Fase 3 — ledger double-entry & pencairan milestone.
 * Acuan: 06-alur-keuangan-escrow.md bagian 3–5, 04-state-diagram.md bagian 4.
 */
class LedgerTest extends TestCase
{
    use RefreshDatabase;

    private User $umkm;

    private User $student;

    private User $mentor;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $this->student = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $this->mentor = User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']);
        $this->project = Project::query()->create([
            'umkm_id' => $this->umkm->id,
            'category_id' => ServiceCategory::query()->create(['name' => 'Branding', 'slug' => 'branding'])->id,
            'title' => 'Project',
            'description' => 'Desc',
            'budget_min' => 1,
            'budget_max' => 1,
            'status' => 'ASSIGNED',
        ]);
    }

    public function test_example_journal_from_design_document(): void
    {
        [$contract, $milestones] = $this->fundedContract([400000, 600000]);

        $first = $this->release($contract, $milestones[0], mentors: 1);
        $this->assertSame([400000, 48000, 14400, 33600, 352000], [
            $first->gross_amount, $first->platform_fee, $first->mentor_fee, $first->platform_net, $first->student_amount,
        ]);
        $this->assertSame('PARTIALLY_RELEASED', $this->escrow($contract)->status);
        $this->assertSame(600000, $this->escrow($contract)->held_amount);

        $second = $this->release($contract, $milestones[1], mentors: 1);
        $this->assertSame([72000, 21600, 50400, 528000], [
            $second->platform_fee, $second->mentor_fee, $second->platform_net, $second->student_amount,
        ]);

        $escrow = $this->escrow($contract);
        $this->assertSame('RELEASED', $escrow->status);
        $this->assertSame(0, $escrow->held_amount);
        $this->assertSame(1000000, $escrow->released_amount);

        $this->assertSame(880000, $this->balance($this->student->id, 'STUDENT'));
        $this->assertSame(36000, $this->balance($this->mentor->id, 'MENTOR'));
        $this->assertSame(84000, $this->balance(null, 'PLATFORM_REVENUE'));
        $this->assertLedgerReconciles();
    }

    public function test_minimum_mentor_fee_applies_to_small_milestones(): void
    {
        [$contract, $milestones] = $this->fundedContract([150000]);

        $settlement = $this->release($contract, $milestones[0], mentors: 1);

        $this->assertSame([18000, 10000, 8000, 132000], [
            $settlement->platform_fee, $settlement->mentor_fee, $settlement->platform_net, $settlement->student_amount,
        ]);
        // Kontrak satu milestone: HELD langsung RELEASED.
        $this->assertSame('RELEASED', $this->escrow($contract)->status);
        $this->assertLedgerReconciles();
    }

    public function test_replaced_mentor_is_also_paid_and_platform_bears_the_difference(): void
    {
        [$contract, $milestones] = $this->fundedContract([150000]);
        $replacement = User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']);
        MentorAssignment::query()->create([
            'milestone_id' => $milestones[0]->id, 'mentor_id' => $this->mentor->id, 'status' => 'REPLACED',
            'review_count' => 1, 'fee_eligible' => true, 'assigned_at' => now()->subDay(), 'replaced_at' => now(),
        ]);
        MentorAssignment::query()->create([
            'milestone_id' => $milestones[0]->id, 'mentor_id' => $replacement->id, 'status' => 'ACTIVE',
            'review_count' => 1, 'fee_eligible' => true, 'assigned_at' => now(),
        ]);

        $settlement = $this->release($contract, $milestones[0]);

        $this->assertSame(20000, $settlement->mentor_fee);
        $this->assertSame(-2000, $settlement->platform_net);
        $this->assertSame(10000, $this->balance($this->mentor->id, 'MENTOR'));
        $this->assertSame(10000, $this->balance($replacement->id, 'MENTOR'));
        $this->assertSame(-2000, $this->balance(null, 'PLATFORM_REVENUE'));
        $this->assertSame(132000, $this->balance($this->student->id, 'STUDENT'));
        $this->assertSame([10000, 10000], MentorAssignment::query()->orderBy('assigned_at')->pluck('fee_amount')->all());
        $this->assertLedgerReconciles();
    }

    public function test_mentor_without_completed_review_is_not_paid(): void
    {
        [$contract, $milestones] = $this->fundedContract([400000]);
        MentorAssignment::query()->create([
            'milestone_id' => $milestones[0]->id, 'mentor_id' => $this->mentor->id, 'status' => 'ACTIVE',
            'review_count' => 0, 'fee_eligible' => false, 'assigned_at' => now(),
        ]);

        $settlement = $this->release($contract, $milestones[0]);

        $this->assertSame(0, $settlement->mentor_fee);
        $this->assertSame(48000, $settlement->platform_net);
        $this->assertSame(0, $this->balance($this->mentor->id, 'MENTOR'));
        $this->assertLedgerReconciles();
    }

    public function test_milestone_cannot_be_released_twice(): void
    {
        [$contract, $milestones] = $this->fundedContract([400000, 600000]);
        $this->release($contract, $milestones[0], mentors: 1);

        $this->expectException(InvalidStateTransition::class);
        try {
            DB::transaction(fn () => app(LedgerService::class)->releaseMilestone($contract->fresh(), $milestones[0]));
        } finally {
            $this->assertSame(1, MilestoneSettlement::query()->count());
            $this->assertSame(352000, $this->balance($this->student->id, 'STUDENT'));
            $this->assertSame(600000, $this->escrow($contract)->held_amount);
        }
    }

    public function test_release_requires_funded_escrow_and_sufficient_balance(): void
    {
        [$contract, $milestones] = $this->fundedContract([400000], fund: false);

        try {
            DB::transaction(fn () => app(LedgerService::class)->releaseMilestone($contract, $milestones[0]));
            $this->fail('Expected unfunded escrow to be rejected.');
        } catch (BusinessRuleViolation) {
            $this->assertSame(0, LedgerTransaction::query()->count());
        }

        [$funded, $fundedMilestones] = $this->fundedContract([400000]);
        Milestone::query()->whereKey($fundedMilestones[0]->id)->update(['amount' => 500000]);

        $this->expectException(BusinessRuleViolation::class);
        DB::transaction(fn () => app(LedgerService::class)->releaseMilestone($funded, $fundedMilestones[0]->fresh()));
    }

    public function test_escrow_funding_rejects_amount_mismatch(): void
    {
        [$contract] = $this->fundedContract([400000], fund: false);
        $payment = $this->payment($contract, 399999);

        $this->expectException(BusinessRuleViolation::class);
        DB::transaction(fn () => app(LedgerService::class)->fundEscrow($this->escrow($contract), $payment));
    }

    public function test_unbalanced_posting_is_rolled_back(): void
    {
        $ledger = app(LedgerService::class);
        $post = new ReflectionMethod($ledger, 'post');

        try {
            DB::transaction(fn () => $post->invoke($ledger, 'TEST', 'TEST', (string) Str::uuid(), 'test:unbalanced', 'x', [
                ['account_type' => 'GATEWAY_CLEARING', 'direction' => 'DEBIT', 'amount' => 1000, 'escrow_id' => null, 'wallet_id' => null],
                ['account_type' => 'GATEWAY_CLEARING', 'direction' => 'CREDIT', 'amount' => 999, 'escrow_id' => null, 'wallet_id' => null],
            ]));
            $this->fail('Expected unbalanced transaction to throw.');
        } catch (LogicException $exception) {
            $this->assertStringContainsString('Unbalanced', $exception->getMessage());
        }

        $this->assertSame(0, LedgerTransaction::query()->count());
        $this->assertSame(0, LedgerEntry::query()->count());
    }

    public function test_wallet_endpoint_shows_balance_and_history(): void
    {
        [$contract, $milestones] = $this->fundedContract([400000]);
        $this->release($contract, $milestones[0], mentors: 1);

        $this->withToken($this->student->createToken('t')->plainTextToken)
            ->getJson('/api/v1/wallet')
            ->assertOk()
            ->assertJsonPath('data.wallet.balance', 352000)
            ->assertJsonPath('data.entries.0.direction', 'CREDIT')
            ->assertJsonPath('data.entries.0.transaction.type', 'MILESTONE_RELEASE');

        $this->app['auth']->forgetGuards();
        $this->withToken($this->mentor->createToken('t')->plainTextToken)
            ->getJson('/api/v1/wallet')->assertOk()->assertJsonPath('data.wallet.balance', 14400);

        $this->app['auth']->forgetGuards();
        $this->withToken($this->umkm->createToken('t')->plainTextToken)->getJson('/api/v1/wallet')->assertStatus(403);
    }

    // ---------------------------------------------------------------- helper

    /** @return array{0: Contract, 1: list<Milestone>} */
    private function fundedContract(array $amounts, bool $fund = true): array
    {
        $contract = Contract::query()->create([
            'contract_no' => 'CTR-'.Str::random(8),
            'project_id' => $this->project->id,
            'umkm_id' => $this->umkm->id,
            'student_id' => $this->student->id,
            'total_amount' => array_sum($amounts),
            'platform_fee_pct' => 12,
            'mentor_share_pct' => 30,
            'mentor_min_fee' => 10000,
            // Status tidak relevan untuk ledger; CANCELLED agar index "satu kontrak aktif" tidak bentrok.
            'status' => 'CANCELLED',
        ]);

        $milestones = [];
        foreach ($amounts as $index => $amount) {
            $milestones[] = Milestone::query()->create([
                'contract_id' => $contract->id, 'sequence' => $index + 1, 'title' => 'M'.($index + 1), 'amount' => $amount, 'status' => 'APPROVED',
            ]);
        }

        $escrow = Escrow::query()->create(['contract_id' => $contract->id, 'status' => 'PENDING_FUNDING']);
        if ($fund) {
            DB::transaction(fn () => app(LedgerService::class)->fundEscrow($escrow, $this->payment($contract, $contract->total_amount)));
        }

        return [$contract->fresh(), $milestones];
    }

    private function payment(Contract $contract, int $amount): Payment
    {
        return Payment::query()->create([
            'payer_id' => $this->umkm->id, 'purpose' => 'ESCROW_FUNDING', 'reference_type' => 'CONTRACT',
            'reference_id' => $contract->id, 'amount' => $amount, 'gateway_fee' => 0, 'gateway' => 'MOCK',
            'gateway_ref' => 'MOCK-'.Str::random(10), 'status' => 'PAID',
        ]);
    }

    private function release(Contract $contract, Milestone $milestone, int $mentors = 0): MilestoneSettlement
    {
        if ($mentors > 0) {
            MentorAssignment::query()->create([
                'milestone_id' => $milestone->id, 'mentor_id' => $this->mentor->id, 'status' => 'DONE',
                'review_count' => 1, 'fee_eligible' => true, 'assigned_at' => now(),
            ]);
        }

        return DB::transaction(fn () => app(LedgerService::class)->releaseMilestone($contract->fresh(), $milestone));
    }

    private function escrow(Contract $contract): Escrow
    {
        return Escrow::query()->where('contract_id', $contract->id)->firstOrFail();
    }

    private function balance(?string $userId, string $type): int
    {
        return (int) Wallet::query()->where('user_id', $userId)->where('type', $type)->value('balance');
    }

    /** Sumber kebenaran = ledger: setiap transaksi seimbang, cache saldo = jumlah entri. */
    private function assertLedgerReconciles(): void
    {
        foreach (LedgerTransaction::query()->with('entries')->get() as $transaction) {
            $this->assertSame(
                $transaction->entries->where('direction', 'DEBIT')->sum('amount'),
                $transaction->entries->where('direction', 'CREDIT')->sum('amount'),
                "Transaction {$transaction->type} is not balanced",
            );
        }

        foreach (Wallet::query()->get() as $wallet) {
            $entries = LedgerEntry::query()->where('wallet_id', $wallet->id)->get();
            $this->assertSame($wallet->balance, $entries->where('direction', 'CREDIT')->sum('amount') - $entries->where('direction', 'DEBIT')->sum('amount'));
        }

        foreach (Escrow::query()->get() as $escrow) {
            $entries = LedgerEntry::query()->where('escrow_id', $escrow->id)->get();
            $this->assertSame($escrow->held_amount, $entries->where('direction', 'CREDIT')->sum('amount') - $entries->where('direction', 'DEBIT')->sum('amount'));
            $this->assertSame($escrow->held_amount, $escrow->funded_amount - $escrow->released_amount - $escrow->refunded_amount);
        }
    }
}
