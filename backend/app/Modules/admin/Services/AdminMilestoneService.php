<?php

namespace App\Modules\admin\Services;

use App\Models\AdminAlert;
use App\Models\Contract;
use App\Models\Milestone;
use App\Models\Submission;
use App\Models\SubmissionReview;
use App\Models\User;
use App\Modules\contract\State\ContractStateMachine;
use App\Modules\notification\Services\NotificationService;
use App\Modules\project\State\MilestoneStateMachine;
use App\Modules\review\Services\MentorAssignmentService;
use App\Modules\review\Services\MilestoneReviewService;
use App\Modules\review\State\SubmissionStateMachine;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use Closure;

/**
 * Keputusan admin atas milestone (08 Admin, 04-state-diagram.md bagian 3, 05-sequence-diagram.md bagian 6).
 * Setiap keputusan: transaksi + lock contract -> milestone -> submission, alert terkait RESOLVED, audit log.
 */
final class AdminMilestoneService
{
    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly MilestoneStateMachine $milestones,
        private readonly SubmissionStateMachine $submissions,
        private readonly ContractStateMachine $contracts,
        private readonly MilestoneReviewService $reviews,
        private readonly MentorAssignmentService $assignments,
        private readonly AdminAlertService $alerts,
        private readonly NotificationService $notifications,
        private readonly SchedulerPlanner $scheduler,
        private readonly AuditLogger $audit,
    ) {}

    /** ESCALATED -> APPROVED (approved_via ADMIN_FORCE) + pencairan dana. */
    public function forceApprove(Milestone $milestone, User $admin, ?string $notes, ?string $ip = null): Milestone
    {
        return $this->decide($milestone, $admin, 'MILESTONE_FORCE_APPROVED', $ip, function (Contract $contract, Milestone $milestone, ?Submission $submission) use ($admin, $notes) {
            // Kasus UMKM diam: hanya setelah follow up tercatat dan batas 7 hari lewat (04 bagian 7).
            $pendingUnresponsive = AdminAlert::query()->where('type', 'UMKM_UNRESPONSIVE')->where('reference_type', 'MILESTONE')
                ->where('reference_id', $milestone->id)->whereIn('status', ['OPEN', 'FOLLOWED_UP'])->exists();
            if ($pendingUnresponsive) {
                throw new InvalidStateTransition('Force approve requires the follow up deadline to have passed (alert AWAITING_DECISION).');
            }
            if (! $submission || ! in_array($submission->status, ['PENDING_CLIENT', 'RETURNED_BY_MENTOR'], true)) {
                throw new InvalidStateTransition('There is no submission that can be approved.');
            }

            $this->submissions->transition($submission, 'ACCEPTED');
            $submission->save();
            $this->review($submission, $admin, 'APPROVED', $notes);

            $this->milestones->transition($milestone, 'APPROVED');
            $milestone->approved_at = now();
            $milestone->approved_via = 'ADMIN_FORCE';
            $milestone->save();

            $this->reviews->finalizeApproval($contract, $milestone);
            $this->notifyParties($contract, 'MILESTONE_FORCE_APPROVED', 'Milestone disetujui admin',
                "Admin menyetujui milestone \"{$milestone->title}\" dan dana dicairkan.", $milestone);
        });
    }

    /** ESCALATED -> IN_PROGRESS: admin meminta perbaikan (tidak menambah revision_count UMKM). */
    public function returnToStudent(Milestone $milestone, User $admin, string $notes, ?string $ip = null): Milestone
    {
        return $this->decide($milestone, $admin, 'MILESTONE_RETURNED_BY_ADMIN', $ip, function (Contract $contract, Milestone $milestone, ?Submission $submission) use ($admin, $notes) {
            if ($submission?->status === 'PENDING_CLIENT') {
                $this->submissions->transition($submission, 'REVISION_REQUESTED');
                $submission->save();
            }
            if ($submission) {
                $this->review($submission, $admin, 'REVISION_REQUESTED', $notes);
            }

            $this->milestones->transition($milestone, 'IN_PROGRESS');
            $milestone->save();

            $this->notifyParties($contract, 'MILESTONE_RETURNED_BY_ADMIN', 'Admin meminta perbaikan',
                "Admin meminta perbaikan untuk milestone \"{$milestone->title}\": {$notes}", $milestone);
        });
    }

    /** Kesempatan tambahan setelah 3x dikembalikan mentor: mentor_return_count direset ke 0. */
    public function extraChance(Milestone $milestone, User $admin, ?string $notes, ?string $ip = null): Milestone
    {
        return $this->decide($milestone, $admin, 'MILESTONE_EXTRA_CHANCE', $ip, function (Contract $contract, Milestone $milestone, ?Submission $submission) {
            $this->assertMentorLimitCase($submission);

            $this->milestones->transition($milestone, 'IN_PROGRESS');
            $milestone->mentor_return_count = 0;
            $milestone->save();

            $this->notifyParties($contract, 'MILESTONE_EXTRA_CHANCE', 'Kesempatan tambahan',
                "Admin memberi kesempatan tambahan untuk milestone \"{$milestone->title}\".", $milestone, studentOnly: true);
        });
    }

    /** ESCALATED -> CLIENT_REVIEW: hasil diteruskan ke UMKM tanpa persetujuan mentor. Timer review dimulai ulang. */
    public function forwardToClient(Milestone $milestone, User $admin, ?string $notes, ?string $ip = null): Milestone
    {
        return $this->decide($milestone, $admin, 'MILESTONE_FORWARDED_TO_CLIENT', $ip, function (Contract $contract, Milestone $milestone, ?Submission $submission) use ($admin, $notes) {
            if (! $submission || ! in_array($submission->status, ['RETURNED_BY_MENTOR', 'PENDING_CLIENT'], true)) {
                throw new InvalidStateTransition('There is no submission that can be forwarded to the client.');
            }
            if ($submission->status === 'RETURNED_BY_MENTOR') {
                $this->submissions->transition($submission, 'PENDING_CLIENT');
                $submission->save();
            }
            $this->review($submission, $admin, 'APPROVED', $notes);

            $this->milestones->transition($milestone, 'CLIENT_REVIEW');
            $milestone->client_review_started_at = now();
            $milestone->client_review_paused_seconds = 0;
            $milestone->save();

            $this->scheduler->clientReviewStarted($milestone);
            $this->notifications->notify(User::query()->find($contract->umkm_id), 'RESULT_READY_FOR_REVIEW', 'Hasil kerja siap direview',
                "Admin meneruskan hasil milestone \"{$milestone->title}\" untuk Anda review.", ['milestone_id' => $milestone->id], [NotificationService::WHATSAPP]);
        });
    }

    /**
     * Ganti mentor: assignment lama REPLACED (tetap dibayar jika fee_eligible), assignment baru ACTIVE,
     * mentor_return_count direset. Milestone ESCALATED kembali IN_PROGRESS.
     */
    public function reassignMentor(Milestone $milestone, User $admin, ?string $mentorId, ?string $ip = null): Milestone
    {
        return $this->transactions->run(function () use ($milestone, $admin, $mentorId, $ip) {
            [$contract, $milestone] = $this->lock($milestone);
            $this->contracts->assertWorkAllowed($contract);

            if (! in_array($milestone->status, ['IN_PROGRESS', 'MENTOR_REVIEW', 'ESCALATED'], true)) {
                throw new InvalidStateTransition('Mentor can only be reassigned while the milestone is in progress, in mentor review, or escalated.', [
                    'status' => $milestone->status,
                ]);
            }

            $before = $this->snapshot($milestone);
            $old = $this->assignments->activeAssignment($milestone, true);
            if ($old && $mentorId && $old->mentor_id === $mentorId) {
                throw new BusinessRuleViolation('The selected mentor is already assigned to this milestone.');
            }

            if ($old) {
                $old->status = 'REPLACED';
                $old->replaced_at = now();
                $old->save();
            }

            $new = $mentorId
                ? $this->assignments->assignSpecific($milestone, $mentorId)
                : $this->assignments->ensureAssigned($milestone, array_filter([$old?->mentor_id]));
            if (! $new) {
                throw new BusinessRuleViolation('No available mentor to assign.');
            }

            $milestone->mentor_return_count = 0;
            if ($milestone->status === 'ESCALATED') {
                $this->milestones->transition($milestone, 'IN_PROGRESS');
            }
            $milestone->save();

            if ($milestone->status === 'MENTOR_REVIEW') {
                $this->scheduler->mentorReviewStarted($milestone, $new->assigned_at);
            }

            $this->alerts->resolveAllFor([$milestone->id], null, null, 'Mentor diganti admin.');
            $this->notifications->notify(User::query()->find($new->mentor_id), 'MENTOR_ASSIGNED', 'Penugasan review baru',
                "Anda ditugaskan sebagai mentor milestone \"{$milestone->title}\".", ['milestone_id' => $milestone->id], [NotificationService::EMAIL]);
            $this->audit->log($admin, 'MILESTONE_MENTOR_REASSIGNED', $milestone, $before + ['mentor_id' => $old?->mentor_id],
                $this->snapshot($milestone) + ['mentor_id' => $new->mentor_id, 'replaced_assignment_id' => $old?->id], $ip);

            return $milestone->fresh();
        });
    }

    // ------------------------------------------------------------------ internal

    /** Kerangka keputusan untuk milestone ESCALATED. */
    private function decide(Milestone $milestone, User $admin, string $action, ?string $ip, Closure $apply): Milestone
    {
        return $this->transactions->run(function () use ($milestone, $admin, $action, $ip, $apply) {
            [$contract, $milestone] = $this->lock($milestone);
            $this->contracts->assertWorkAllowed($contract);

            if ($milestone->status !== 'ESCALATED') {
                throw new InvalidStateTransition('This decision is only available for ESCALATED milestones.', ['status' => $milestone->status]);
            }

            $before = $this->snapshot($milestone);
            $submission = Submission::query()->where('milestone_id', $milestone->id)->orderByDesc('version_no')->lockForUpdate()->first();

            $apply($contract, $milestone, $submission);

            $this->alerts->resolveAllFor([$milestone->id], null, null, "Keputusan admin: {$action}.");
            $this->audit->log($admin, $action, $milestone, $before, $this->snapshot($milestone->fresh()) + ['submission_id' => $submission?->id], $ip);

            return $milestone->fresh();
        });
    }

    private function assertMentorLimitCase(?Submission $submission): void
    {
        if ($submission?->status !== 'RETURNED_BY_MENTOR') {
            throw new InvalidStateTransition('Extra chance is only for milestones escalated by the mentor return limit.');
        }
    }

    private function review(Submission $submission, User $admin, string $decision, ?string $feedback): void
    {
        SubmissionReview::query()->create([
            'submission_id' => $submission->id,
            'reviewer_id' => $admin->id,
            'reviewer_role' => 'ADMIN',
            'decision' => $decision,
            'feedback' => $feedback,
            'reviewed_at' => now(),
        ]);
    }

    /** @return array{0: Contract, 1: Milestone} */
    private function lock(Milestone $milestone): array
    {
        $contract = Contract::query()->lockForUpdate()->findOrFail($milestone->contract_id);
        $milestone = Milestone::query()->lockForUpdate()->findOrFail($milestone->id);

        return [$contract, $milestone];
    }

    private function snapshot(Milestone $milestone): array
    {
        return $milestone->only(['status', 'revision_count', 'mentor_return_count', 'approved_via']);
    }

    private function notifyParties(Contract $contract, string $type, string $title, string $body, Milestone $milestone, bool $studentOnly = false): void
    {
        $ids = $studentOnly ? [$contract->student_id] : [$contract->umkm_id, $contract->student_id];
        $this->notifications->notify(User::query()->whereIn('id', $ids)->get(), $type, $title, $body, ['milestone_id' => $milestone->id]);
    }
}
