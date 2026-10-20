<?php

namespace Tests\Feature\Concerns;

use App\Models\Contract;
use App\Models\Escrow;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\MentorAssignment;
use App\Models\MentorProfile;
use App\Models\Milestone;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\Submission;
use App\Models\User;
use App\Models\Wallet;
use App\Modules\ledger\Services\LedgerService;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Fixture kontrak yang sudah didanai lewat ledger, dipakai test Fase 6. */
trait BuildsContracts
{
    protected User $umkm;

    protected User $student;

    protected User $mentor;

    protected User $admin;

    protected Project $project;

    protected function setUpParties(): void
    {
        $this->seed(PlatformSettingsSeeder::class);

        $this->umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $this->student = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $this->mentor = $this->makeMentor();
        $this->admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
        $this->project = Project::query()->create([
            'umkm_id' => $this->umkm->id,
            'category_id' => ServiceCategory::query()->create(['name' => 'Branding', 'slug' => 'branding-'.Str::random(4)])->id,
            'title' => 'Setup Instagram',
            'description' => 'Desc',
            'budget_min' => 1,
            'budget_max' => 1,
            'deadline' => now()->addMonth()->toDateString(),
            'status' => 'ASSIGNED',
        ]);
    }

    protected function makeMentor(): User
    {
        $mentor = User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']);
        MentorProfile::query()->create([
            'user_id' => $mentor->id, 'title' => 'Senior', 'institution' => 'Studio',
            'verification_status' => 'VERIFIED', 'max_active_reviews' => 5, 'is_available' => true,
        ]);

        return $mentor;
    }

    /**
     * @param  list<array{0: int, 1: string}>  $milestones  [nominal, status]
     */
    protected function makeContract(string $status, array $milestones, bool $funded = true): Contract
    {
        $contract = Contract::query()->create([
            'contract_no' => 'CTR-'.Str::upper(Str::random(8)),
            'project_id' => $this->project->id,
            'umkm_id' => $this->umkm->id,
            'student_id' => $this->student->id,
            'total_amount' => array_sum(array_column($milestones, 0)),
            'platform_fee_pct' => 12,
            'mentor_share_pct' => 30,
            'mentor_min_fee' => 10000,
            'status' => $status,
            'funded_at' => $funded ? now() : null,
            'started_at' => $status === 'IN_PROGRESS' ? now() : null,
        ]);

        foreach ($milestones as $index => [$amount, $milestoneStatus]) {
            Milestone::query()->create([
                'contract_id' => $contract->id, 'sequence' => $index + 1, 'title' => 'Milestone '.($index + 1),
                'amount' => $amount, 'status' => $milestoneStatus, 'max_revisions' => 2, 'max_mentor_returns' => 3,
            ]);
        }

        $escrow = Escrow::query()->create(['contract_id' => $contract->id, 'status' => 'PENDING_FUNDING']);
        $payment = Payment::query()->create([
            'payer_id' => $this->umkm->id, 'purpose' => 'ESCROW_FUNDING', 'reference_type' => 'CONTRACT',
            'reference_id' => $contract->id, 'amount' => $contract->total_amount, 'gateway_fee' => 4000,
            'gateway' => 'MOCK', 'gateway_ref' => 'MOCK-'.Str::upper(Str::random(12)),
            'status' => $funded ? 'PAID' : 'PENDING', 'paid_at' => $funded ? now() : null, 'expires_at' => now()->addDay(),
        ]);

        if ($funded) {
            DB::transaction(fn () => app(LedgerService::class)->fundEscrow($escrow, $payment));
        }

        return $contract->fresh();
    }

    protected function milestoneOf(Contract $contract, int $sequence): Milestone
    {
        return Milestone::query()->where('contract_id', $contract->id)->where('sequence', $sequence)->firstOrFail();
    }

    /** Milestone sudah disetujui & dicairkan sebelumnya (lewat ledger). */
    protected function releaseMilestone(Contract $contract, Milestone $milestone): void
    {
        $this->assignMentor($milestone, $this->mentor, eligible: true, status: 'DONE');
        DB::transaction(fn () => app(LedgerService::class)->releaseMilestone($contract->fresh(), $milestone));
        $milestone->update(['status' => 'APPROVED', 'approved_at' => now(), 'approved_via' => 'CLIENT']);
    }

    protected function assignMentor(Milestone $milestone, User $mentor, bool $eligible = false, string $status = 'ACTIVE', int $reviews = 0): MentorAssignment
    {
        $milestone->update(['mentor_id' => $mentor->id]);

        return MentorAssignment::query()->create([
            'milestone_id' => $milestone->id, 'mentor_id' => $mentor->id, 'status' => $status,
            'review_count' => $reviews ?: ($eligible ? 1 : 0), 'fee_eligible' => $eligible, 'assigned_at' => now(),
        ]);
    }

    protected function makeSubmission(Milestone $milestone, string $status, int $version = 1): Submission
    {
        return Submission::query()->create([
            'milestone_id' => $milestone->id, 'version_no' => $version, 'status' => $status, 'submitted_at' => now(),
        ]);
    }

    protected function actingWith(User $user): static
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('t')->plainTextToken);
    }

    protected function balance(?string $userId, string $type): int
    {
        return (int) Wallet::query()->where('user_id', $userId)->where('type', $type)->value('balance');
    }

    protected function assertLedgerReconciles(): void
    {
        foreach (LedgerTransaction::query()->with('entries')->get() as $transaction) {
            $this->assertSame(
                $transaction->entries->where('direction', 'DEBIT')->sum('amount'),
                $transaction->entries->where('direction', 'CREDIT')->sum('amount'),
                "Transaction {$transaction->type} {$transaction->idempotency_key} is not balanced",
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
