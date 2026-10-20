<?php

namespace App\Modules\application\Services;

use App\Models\Application;
use App\Models\Contract;
use App\Models\Invitation;
use App\Models\Project;
use App\Models\StudentProfile;
use App\Models\User;
use App\Modules\application\State\ApplicationStateMachine;
use App\Modules\chat\Services\ChatService;
use App\Modules\contract\Services\ContractFactory;
use App\Modules\matching\Services\MatchingService;
use App\Modules\notification\Services\NotificationService;
use App\Modules\project\State\ProjectStateMachine;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/** Lamaran mahasiswa dan penerimaan oleh UMKM (05-sequence-diagram.md bagian 1). */
final class ApplicationService
{
    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly ApplicationStateMachine $applications,
        private readonly ProjectStateMachine $projects,
        private readonly ContractFactory $contracts,
        private readonly MatchingService $matching,
        private readonly PlatformSettingsService $settings,
        private readonly AuditLogger $audit,
        private readonly NotificationService $notifications,
        private readonly ChatService $chat,
    ) {}

    /**
     * @param  array{proposal: string, offered_price: int, estimated_days: int, proposed_milestones?: list<array>|null}  $input
     */
    public function apply(Project $project, User $student, array $input): Application
    {
        return $this->transactions->run(function () use ($project, $student, $input) {
            // Urutan lock sama di semua alur (project -> lamaran/undangan -> profil mahasiswa)
            // agar tidak deadlock. Lock profil membuat cek batas kontrak & lamaran ganda atomik.
            $project = Project::query()->lockForUpdate()->findOrFail($project->id);
            if ($project->status !== 'OPEN') {
                throw new InvalidStateTransition('Applications are only allowed on OPEN projects.', ['status' => $project->status]);
            }

            $profile = StudentProfile::query()->where('user_id', $student->id)->lockForUpdate()->first();
            if (! $profile || $profile->verification_status !== 'VERIFIED') {
                throw new BusinessRuleViolation('Only verified students can apply to projects.');
            }

            $this->assertActiveContractLimit($student->id);

            $existing = Application::query()
                ->where('project_id', $project->id)
                ->where('student_id', $student->id)
                ->whereIn('status', ['PENDING', 'SHORTLISTED', 'ACCEPTED', 'REJECTED'])
                ->exists();
            if ($existing) {
                throw new BusinessRuleViolation('You already have an application for this project.');
            }

            $milestones = $input['proposed_milestones'] ?? null;
            if (empty($milestones)) {
                $milestones = $this->milestonesFromTemplate($project, (int) $input['offered_price'], (int) $input['estimated_days']);
            }
            $milestones = $this->validateMilestones($milestones, (int) $input['offered_price']);

            $invitation = Invitation::query()
                ->where('project_id', $project->id)
                ->where('student_id', $student->id)
                ->where('status', 'ACCEPTED')
                ->latest()
                ->first();

            $application = Application::query()->create([
                'project_id' => $project->id,
                'student_id' => $student->id,
                'invitation_id' => $invitation?->id,
                'proposal' => $input['proposal'],
                'offered_price' => (int) $input['offered_price'],
                'estimated_days' => (int) $input['estimated_days'],
                'proposed_milestones' => $milestones,
                'match_score' => $this->matching->score($profile, $project->loadMissing('umkm.umkmProfile')),
                'status' => 'PENDING',
            ]);

            $this->chat->conversationFor($project, $student->id);
            $this->notifications->notify($project->umkm, 'APPLICATION_RECEIVED', 'Lamaran baru masuk',
                "{$student->name} melamar project \"{$project->title}\".",
                ['project_id' => $project->id, 'application_id' => $application->id], [NotificationService::WHATSAPP]);

            return $application;
        });
    }

    public function withdraw(Application $application, User $student): Application
    {
        if ($application->student_id !== $student->id) {
            throw new AuthorizationException('Only the applicant can withdraw this application.');
        }

        return $this->transactions->run(function () use ($application) {
            $application = Application::query()->lockForUpdate()->findOrFail($application->id);
            $this->applications->transition($application, 'WITHDRAWN');
            $application->save();

            return $application;
        });
    }

    public function reject(Application $application, User $umkm): Application
    {
        $this->assertProjectOwner($application, $umkm);

        return $this->transactions->run(function () use ($application) {
            $application = Application::query()->lockForUpdate()->findOrFail($application->id);
            $this->applications->transition($application, 'REJECTED');
            $application->save();

            $this->notifyDecision(collect([$application]), false);

            return $application;
        });
    }

    /**
     * UMKM menerima lamaran: kontrak AWAITING_PAYMENT, milestone LOCKED, escrow
     * PENDING_FUNDING, project ASSIGNED, lamaran lain REJECTED — dalam satu transaksi.
     */
    public function accept(Application $application, User $umkm, ?string $ip = null): Contract
    {
        $this->assertProjectOwner($application, $umkm);

        return $this->transactions->run(function () use ($application, $umkm, $ip) {
            $project = Project::query()->lockForUpdate()->findOrFail($application->project_id);
            $application = Application::query()->lockForUpdate()->findOrFail($application->id);

            if ($project->status !== 'OPEN') {
                throw new InvalidStateTransition('Project is not open for acceptance.', ['status' => $project->status]);
            }
            $this->applications->transition($application, 'ACCEPTED');

            // Lock profil mahasiswa lalu hitung ulang kontrak aktif: dua UMKM yang menerima
            // bersamaan tidak boleh membuat mahasiswa punya lebih dari batas kontrak aktif.
            StudentProfile::query()->where('user_id', $application->student_id)->lockForUpdate()->first();
            $active = Contract::activeCountForStudent($application->student_id);
            $max = $this->settings->int('max_active_contracts_per_student');
            if ($active >= $max) {
                throw new InvalidStateTransition('Student has reached the active contract limit. Choose another applicant.', [
                    'active_contracts' => $active,
                    'max_active_contracts' => $max,
                ]);
            }

            $application->save();

            $rejected = Application::query()
                ->where('project_id', $project->id)
                ->where('id', '!=', $application->id)
                ->whereIn('status', ApplicationStateMachine::OPEN_STATUSES)
                ->lockForUpdate()
                ->get();
            foreach ($rejected as $other) {
                $this->applications->transition($other, 'REJECTED');
                $other->save();
            }

            $contract = $this->contracts->createFromApplication($project, $application);
            $this->chat->conversationFor($project, $application->student_id, $contract->id);

            $this->projects->transition($project, 'ASSIGNED');
            $project->save();

            $this->audit->log($umkm, 'CONTRACT_CREATED', $contract, null, [
                'application_id' => $application->id,
                'total_amount' => $contract->total_amount,
                'platform_fee_pct' => $contract->platform_fee_pct,
                'mentor_share_pct' => $contract->mentor_share_pct,
                'mentor_min_fee' => $contract->mentor_min_fee,
                'rejected_application_ids' => $rejected->pluck('id')->all(),
            ], $ip);

            $this->notifyDecision(collect([$application]), true);
            $this->notifyDecision($rejected, false);

            return $contract->load(['milestones', 'escrow']);
        });
    }

    public function assertActiveContractLimit(string $studentUserId): void
    {
        $active = Contract::activeCountForStudent($studentUserId);
        $max = $this->settings->int('max_active_contracts_per_student');

        if ($active >= $max) {
            throw new BusinessRuleViolation('Student already has the maximum number of active contracts.', [
                'active_contracts' => $active,
                'max_active_contracts' => $max,
            ]);
        }
    }

    /**
     * Total milestone = harga penawaran, tiap milestone >= min_milestone_amount,
     * due_date tidak mundur dari milestone sebelumnya.
     *
     * @param  list<array>  $milestones
     * @return list<array{title: string, description: ?string, amount: int, due_date: ?string}>
     */
    private function validateMilestones(array $milestones, int $offeredPrice): array
    {
        $minAmount = $this->settings->int('min_milestone_amount');
        $normalized = [];
        $previousDue = null;

        foreach (array_values($milestones) as $index => $milestone) {
            $amount = (int) $milestone['amount'];
            if ($amount < $minAmount) {
                throw new BusinessRuleViolation("Each milestone must be at least Rp {$minAmount}.", [
                    'milestone_index' => $index,
                    'amount' => $amount,
                    'min_milestone_amount' => $minAmount,
                ]);
            }

            $due = isset($milestone['due_date']) ? Carbon::parse($milestone['due_date'])->startOfDay() : null;
            if ($due && $previousDue && $due->lt($previousDue)) {
                throw new BusinessRuleViolation('Milestone due dates must be in sequential order.', ['milestone_index' => $index]);
            }
            $previousDue = $due ?? $previousDue;

            $normalized[] = [
                'title' => (string) $milestone['title'],
                'description' => $milestone['description'] ?? null,
                'amount' => $amount,
                'due_date' => $due?->toDateString(),
            ];
        }

        $total = array_sum(array_column($normalized, 'amount'));
        if ($total !== $offeredPrice) {
            throw new BusinessRuleViolation('Total milestone amount must equal the offered price.', [
                'milestone_total' => $total,
                'offered_price' => $offeredPrice,
            ]);
        }

        return $normalized;
    }

    /**
     * Usulan milestone default dari template (README aturan 8). Nominal dibulatkan ke bawah,
     * sisa pembulatan masuk ke milestone terakhir; due date dibagi proporsional dari estimated_days.
     *
     * @return list<array>
     */
    private function milestonesFromTemplate(Project $project, int $offeredPrice, int $estimatedDays): array
    {
        $defaults = $project->template?->default_milestones ?? [];
        $totalPct = array_sum(array_map(fn ($item) => (float) ($item['percentage'] ?? 0), $defaults));

        if ($defaults === [] || abs($totalPct - 100) > 0.001) {
            throw new BusinessRuleViolation('proposed_milestones is required because the project has no usable template.');
        }

        $milestones = [];
        $allocated = 0;
        $cumulativePct = 0.0;
        $lastIndex = count($defaults) - 1;

        foreach (array_values($defaults) as $index => $item) {
            $cumulativePct += (float) $item['percentage'];
            $amount = $index === $lastIndex
                ? $offeredPrice - $allocated
                : (int) floor($offeredPrice * (float) $item['percentage'] / 100);
            $allocated += $amount;

            $milestones[] = [
                'title' => $item['title'],
                'description' => $item['description'] ?? null,
                'amount' => $amount,
                'due_date' => now()->addDays((int) ceil($estimatedDays * $cumulativePct / 100))->toDateString(),
            ];
        }

        return $milestones;
    }

    /** Lamaran diterima / ditolak -> mahasiswa (In-app, Email). */
    private function notifyDecision(Collection $applications, bool $accepted): void
    {
        foreach ($applications as $application) {
            $title = Project::query()->whereKey($application->project_id)->value('title');
            $this->notifications->notify(User::query()->find($application->student_id),
                $accepted ? 'APPLICATION_ACCEPTED' : 'APPLICATION_REJECTED',
                $accepted ? 'Lamaran diterima' : 'Lamaran ditolak',
                $accepted ? "Lamaran Anda untuk \"{$title}\" diterima. Menunggu pembayaran UMKM." : "Lamaran Anda untuk \"{$title}\" tidak dipilih.",
                ['application_id' => $application->id, 'project_id' => $application->project_id],
                [NotificationService::EMAIL]);
        }
    }

    private function assertProjectOwner(Application $application, User $umkm): void
    {
        if ($application->project()->value('umkm_id') !== $umkm->id) {
            throw new AuthorizationException('Only the project owner can manage its applications.');
        }
    }
}
