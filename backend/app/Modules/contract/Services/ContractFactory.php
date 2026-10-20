<?php

namespace App\Modules\contract\Services;

use App\Models\Application;
use App\Models\Contract;
use App\Models\Escrow;
use App\Models\Milestone;
use App\Models\Project;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Support\Str;

/**
 * Membuat kontrak dari lamaran yang diterima (05-sequence-diagram.md bagian 1):
 * contract AWAITING_PAYMENT + snapshot fee, milestones LOCKED, escrow PENDING_FUNDING.
 * Dipanggil di dalam transaksi pemanggil yang sudah mengunci project, lamaran, dan profil mahasiswa.
 */
final class ContractFactory
{
    public function __construct(private readonly PlatformSettingsService $settings) {}

    public function createFromApplication(Project $project, Application $application): Contract
    {
        $milestones = array_values($application->proposed_milestones ?? []);
        $total = (int) array_sum(array_column($milestones, 'amount'));

        if ($milestones === [] || $total !== $application->offered_price) {
            throw new BusinessRuleViolation('Total milestone amount must equal the offered price.', [
                'milestone_total' => $total,
                'offered_price' => $application->offered_price,
            ]);
        }

        $contract = Contract::query()->create([
            'contract_no' => $this->generateContractNo(),
            'project_id' => $project->id,
            'application_id' => $application->id,
            'umkm_id' => $project->umkm_id,
            'student_id' => $application->student_id,
            'total_amount' => $total,
            // Snapshot: perubahan setting setelah ini tidak memengaruhi kontrak berjalan.
            'platform_fee_pct' => $this->settings->number('platform_fee_pct'),
            'mentor_share_pct' => $this->settings->number('mentor_share_pct'),
            'mentor_min_fee' => $this->settings->int('mentor_min_fee'),
            'status' => 'AWAITING_PAYMENT',
            'payment_due_at' => now()->addHours($this->settings->int('payment_expiry_hours')),
        ]);

        $maxRevisions = $this->settings->int('max_revisions_per_milestone');
        $maxMentorReturns = $this->settings->int('max_mentor_returns_per_milestone');

        foreach ($milestones as $index => $milestone) {
            Milestone::query()->create([
                'contract_id' => $contract->id,
                'sequence' => $index + 1,
                'title' => $milestone['title'],
                'description' => $milestone['description'] ?? null,
                'amount' => (int) $milestone['amount'],
                'due_date' => $milestone['due_date'] ?? null,
                'status' => 'LOCKED',
                'revision_count' => 0,
                'max_revisions' => $maxRevisions,
                'mentor_return_count' => 0,
                'max_mentor_returns' => $maxMentorReturns,
            ]);
        }

        Escrow::query()->create([
            'contract_id' => $contract->id,
            'funded_amount' => 0,
            'released_amount' => 0,
            'refunded_amount' => 0,
            'held_amount' => 0,
            'status' => 'PENDING_FUNDING',
        ]);

        return $contract;
    }

    private function generateContractNo(): string
    {
        return 'CTR-'.now()->format('Ymd').'-'.Str::upper(Str::random(8));
    }
}
