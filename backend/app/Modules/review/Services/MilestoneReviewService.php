<?php

namespace App\Modules\review\Services;

use App\Models\Contract;
use App\Models\MentorAssignment;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\Submission;
use App\Models\SubmissionFile;
use App\Models\SubmissionReview;
use App\Models\User;
use App\Modules\admin\Services\AdminAlertService;
use App\Modules\certificate\Services\CertificateService;
use App\Modules\contract\State\ContractStateMachine;
use App\Modules\ledger\Services\LedgerService;
use App\Modules\notification\Services\NotificationService;
use App\Modules\project\State\MilestoneStateMachine;
use App\Modules\project\State\ProjectStateMachine;
use App\Modules\review\State\SubmissionStateMachine;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Alur milestone: submit -> mentor review -> client review (05-sequence-diagram.md bagian 3,
 * 04-state-diagram.md bagian 3). Semua perubahan status lewat state machine terpusat dan
 * dijalankan di dalam transaksi dengan urutan lock: contract -> milestone -> submission -> assignment.
 */
final class MilestoneReviewService
{
    public const FILE_DISK = 'local';

    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly MilestoneStateMachine $milestones,
        private readonly SubmissionStateMachine $submissions,
        private readonly ContractStateMachine $contracts,
        private readonly ProjectStateMachine $projects,
        private readonly MentorAssignmentService $assignments,
        private readonly AdminAlertService $alerts,
        private readonly AuditLogger $audit,
        private readonly LedgerService $ledger,
        private readonly SchedulerPlanner $scheduler,
        private readonly NotificationService $notifications,
        private readonly CertificateService $certificates,
    ) {}

    /**
     * LOCKED -> IN_PROGRESS lalu tugaskan mentor. Dipanggil di dalam transaksi yang
     * sudah mengunci kontrak (saat Mulai Kerja atau setelah milestone sebelumnya APPROVED).
     */
    public function openMilestone(Milestone $milestone): Milestone
    {
        $this->milestones->transition($milestone, 'IN_PROGRESS');
        $milestone->started_at = now();
        $milestone->save();

        $this->assignments->ensureAssigned($milestone);
        $this->scheduler->milestoneOpened($milestone);

        return $milestone;
    }

    /**
     * @param  list<UploadedFile>  $files
     */
    public function submit(Milestone $milestone, User $student, ?string $notes, array $files, ?string $ip = null): Submission
    {
        $this->assertStudentOwner($milestone, $student);

        $storedPaths = [];

        try {
            return $this->transactions->run(function () use ($milestone, $student, $notes, $files, $ip, &$storedPaths) {
                [$contract, $milestone] = $this->lockContractAndMilestone($milestone);
                $this->contracts->assertWorkAllowed($contract);

                $before = $this->milestoneSnapshot($milestone);
                $this->milestones->transition($milestone, 'MENTOR_REVIEW');
                $milestone->save();

                // Mentor mungkin belum ada saat milestone dibuka (tidak ada mentor tersedia), coba lagi.
                $this->assignments->ensureAssigned($milestone);

                $submission = Submission::query()->create([
                    'milestone_id' => $milestone->id,
                    'version_no' => ((int) Submission::query()->where('milestone_id', $milestone->id)->max('version_no')) + 1,
                    'notes' => $notes,
                    'status' => 'PENDING_MENTOR',
                    'submitted_at' => now(),
                ]);

                foreach ($files as $file) {
                    $path = $file->store('submissions/'.$submission->id, self::FILE_DISK);
                    if ($path === false) {
                        throw new \RuntimeException('Failed to store submission file.');
                    }
                    $storedPaths[] = $path;

                    SubmissionFile::query()->create([
                        'submission_id' => $submission->id,
                        'file_url' => $path,
                        'file_name' => $file->getClientOriginalName(),
                        'mime_type' => $file->getMimeType(),
                        'size_bytes' => $file->getSize(),
                    ]);
                }

                $this->audit->log($student, 'MILESTONE_SUBMITTED', $milestone, $before, $this->milestoneSnapshot($milestone) + [
                    'submission_id' => $submission->id,
                    'version_no' => $submission->version_no,
                ], $ip);

                $this->scheduler->submissionCreated($milestone, $submission);

                if ($mentorId = $this->assignments->activeAssignment($milestone)?->mentor_id) {
                    $this->notifications->notify(User::query()->find($mentorId), 'SUBMISSION_NEEDS_REVIEW', 'Submission perlu direview',
                        "Ada submission baru untuk milestone \"{$milestone->title}\".",
                        ['milestone_id' => $milestone->id, 'submission_id' => $submission->id], [NotificationService::EMAIL]);
                }

                return $submission->load('files');
            }, 1);
        } catch (Throwable $exception) {
            // File sudah ditulis tapi transaksi gagal: hapus agar tidak ada file yatim.
            if ($storedPaths !== []) {
                Storage::disk(self::FILE_DISK)->delete($storedPaths);
            }

            throw $exception;
        }
    }

    public function mentorReview(Submission $submission, User $mentor, string $decision, ?string $feedback, ?string $ip = null): Milestone
    {
        return $this->transactions->run(function () use ($submission, $mentor, $decision, $feedback, $ip) {
            [$contract, $milestone] = $this->lockContractAndMilestone($submission->milestone()->firstOrFail());

            $assignment = $this->assignments->activeAssignment($milestone, true);
            if (! $assignment || $assignment->mentor_id !== $mentor->id) {
                throw new AuthorizationException('Only the assigned mentor can review this submission.');
            }

            $this->contracts->assertWorkAllowed($contract);
            if ($milestone->status !== 'MENTOR_REVIEW') {
                throw new InvalidStateTransition('Milestone is not awaiting mentor review.', ['status' => $milestone->status]);
            }
            $submission = $this->lockLatestSubmission($milestone, $submission, 'PENDING_MENTOR');

            $before = $this->milestoneSnapshot($milestone);

            // Mentor dibayar sekali per milestone begitu menyelesaikan review pertama.
            $assignment->review_count += 1;
            $assignment->fee_eligible = true;
            $assignment->save();

            SubmissionReview::query()->create([
                'submission_id' => $submission->id,
                'reviewer_id' => $mentor->id,
                'reviewer_role' => 'MENTOR',
                'decision' => $decision,
                'feedback' => $feedback,
                'reviewed_at' => now(),
            ]);

            if ($decision === 'APPROVED') {
                $this->submissions->transition($submission, 'PENDING_CLIENT');
                $this->milestones->transition($milestone, 'CLIENT_REVIEW');
                // Acuan timer UMKM tidak merespons (reminder & alert dijadwalkan di fase scheduler).
                $milestone->client_review_started_at = now();
                $milestone->client_review_paused_seconds = 0;
            } else {
                // NEEDS_CHANGES: tidak menambah revision_count UMKM.
                $this->submissions->transition($submission, 'RETURNED_BY_MENTOR');
                $milestone->mentor_return_count += 1;

                if ($milestone->mentor_return_count >= $milestone->max_mentor_returns) {
                    $this->milestones->transition($milestone, 'ESCALATED');
                    $this->alerts->open('MENTOR_RETURN_LIMIT', 'MEDIUM', 'MILESTONE', $milestone->id);
                } else {
                    $this->milestones->transition($milestone, 'IN_PROGRESS');
                }
            }

            $submission->save();
            $milestone->save();

            // Mentor akhirnya mereview: alert keterlambatan mentor tidak relevan lagi.
            $this->alerts->resolve('MENTOR_OVERDUE', 'MILESTONE', $milestone->id, 'Mentor menyelesaikan review.', AdminAlertService::UNRESOLVED);
            $this->notifyAfterMentorReview($contract, $milestone);

            $this->audit->log($mentor, 'MILESTONE_MENTOR_REVIEWED', $milestone, $before, $this->milestoneSnapshot($milestone) + [
                'submission_id' => $submission->id,
                'decision' => $decision,
            ], $ip);

            return $milestone;
        });
    }

    public function clientReview(Submission $submission, User $umkm, string $decision, ?string $feedback, ?string $ip = null): Milestone
    {
        $milestone = $submission->milestone()->firstOrFail();
        $this->assertUmkmOwner($milestone, $umkm);

        return $this->transactions->run(function () use ($milestone, $submission, $umkm, $decision, $feedback, $ip) {
            [$contract, $milestone] = $this->lockContractAndMilestone($milestone);
            $this->contracts->assertWorkAllowed($contract);

            if ($milestone->status !== 'CLIENT_REVIEW') {
                throw new InvalidStateTransition('Milestone is not awaiting client review.', ['status' => $milestone->status]);
            }
            $submission = $this->lockLatestSubmission($milestone, $submission, 'PENDING_CLIENT');

            $before = $this->milestoneSnapshot($milestone);

            if ($decision === 'REVISION_REQUESTED') {
                // 422 jika revision_count sudah mencapai max_revisions.
                $this->milestones->assertRevisionAllowed($milestone);

                $milestone->revision_count += 1;
                $this->milestones->transition($milestone, 'REVISION_REQUESTED');
                $this->milestones->transition($milestone, 'IN_PROGRESS');
                $this->submissions->transition($submission, 'REVISION_REQUESTED');
            } else {
                $this->submissions->transition($submission, 'ACCEPTED');
                $this->milestones->transition($milestone, 'APPROVED');
                $milestone->approved_at = now();
                $milestone->approved_via = 'CLIENT';
            }

            $submission->save();
            $milestone->save();

            SubmissionReview::query()->create([
                'submission_id' => $submission->id,
                'reviewer_id' => $umkm->id,
                'reviewer_role' => 'UMKM',
                'decision' => $decision,
                'feedback' => $feedback,
                'reviewed_at' => now(),
            ]);

            // UMKM merespons: alert UMKM_UNRESPONSIVE yang belum diputuskan admin ditutup.
            // Reminder yang sudah terjadwal otomatis tidak berlaku karena status/siklus berubah.
            $this->alerts->resolve('UMKM_UNRESPONSIVE', 'MILESTONE', $milestone->id, 'UMKM merespons review.', ['OPEN', 'FOLLOWED_UP']);

            $student = User::query()->find($contract->student_id);
            if ($decision === 'APPROVED') {
                $this->finalizeApproval($contract, $milestone);
            } else {
                $this->notifications->notify($student, 'REVISION_REQUESTED', 'UMKM meminta revisi',
                    "UMKM meminta revisi untuk milestone \"{$milestone->title}\" (revisi ke-{$milestone->revision_count}).",
                    ['milestone_id' => $milestone->id]);
            }

            $this->audit->log($umkm, 'MILESTONE_CLIENT_REVIEWED', $milestone, $before, $this->milestoneSnapshot($milestone) + [
                'submission_id' => $submission->id,
                'decision' => $decision,
            ], $ip);

            return $milestone;
        });
    }

    /**
     * Sengketa hanya setelah jatah revisi UMKM habis (04-state-diagram.md: CLIENT_REVIEW -> ESCALATED).
     */
    public function dispute(Milestone $milestone, User $actor, string $reason, ?string $ip = null): Milestone
    {
        $contract = $milestone->contract()->firstOrFail();
        if (! in_array($actor->id, [$contract->umkm_id, $contract->student_id], true)) {
            throw new AuthorizationException('Only contract parties can open a dispute.');
        }

        return $this->transactions->run(function () use ($milestone, $actor, $reason, $ip) {
            [$contract, $milestone] = $this->lockContractAndMilestone($milestone);
            $this->contracts->assertWorkAllowed($contract);

            if ($milestone->status !== 'CLIENT_REVIEW') {
                throw new InvalidStateTransition('Disputes can only be opened while the milestone is in CLIENT_REVIEW.', [
                    'status' => $milestone->status,
                ]);
            }

            if ($milestone->revision_count < $milestone->max_revisions) {
                throw new BusinessRuleViolation('Disputes are only allowed after all revisions have been used.', [
                    'revision_count' => $milestone->revision_count,
                    'max_revisions' => $milestone->max_revisions,
                ]);
            }

            $before = $this->milestoneSnapshot($milestone);
            $this->milestones->transition($milestone, 'ESCALATED');
            $milestone->save();

            // Mengajukan sengketa = UMKM/mahasiswa merespons; alert UMKM_UNRESPONSIVE tidak relevan lagi.
            $this->alerts->resolve('UMKM_UNRESPONSIVE', 'MILESTONE', $milestone->id, 'Sengketa diajukan.', ['OPEN', 'FOLLOWED_UP']);
            $alert = $this->alerts->open('REVISION_LIMIT_DISPUTE', 'MEDIUM', 'MILESTONE', $milestone->id);
            $this->notifications->notifyAdmins('ADMIN_ALERT', 'Sengketa milestone diajukan',
                "Sengketa diajukan untuk milestone \"{$milestone->title}\" setelah batas revisi habis.",
                ['alert_id' => $alert->id, 'milestone_id' => $milestone->id], [NotificationService::IN_APP]);

            $this->audit->log($actor, 'MILESTONE_DISPUTED', $milestone, $before, $this->milestoneSnapshot($milestone) + [
                'reason' => $reason,
                'requester_role' => $actor->id === $contract->umkm_id ? 'UMKM' : 'STUDENT',
                'admin_alert_id' => $alert->id,
            ], $ip);

            return $milestone;
        });
    }

    /**
     * Setelah milestone APPROVED (dalam transaksi yang sama): cairkan dana milestone
     * (MILESTONE_RELEASE + milestone_settlement), tutup assignment mentor, lalu buka
     * milestone berikutnya atau selesaikan kontrak jika ini milestone terakhir.
     * Jika pencairan gagal (misal escrow belum didanai), seluruh approval di-rollback.
     */
    public function finalizeApproval(Contract $contract, Milestone $milestone): void
    {
        $settlement = $this->ledger->releaseMilestone($contract, $milestone);
        $mentorIds = MentorAssignment::query()->where('milestone_id', $milestone->id)->whereNotNull('fee_paid_at')->pluck('mentor_id');
        $this->assignments->complete($milestone);

        $this->notifications->notify(User::query()->find($contract->student_id), 'MILESTONE_APPROVED', 'Milestone disetujui, saldo masuk',
            "Milestone \"{$milestone->title}\" disetujui. Rp ".number_format($settlement->student_amount, 0, ',', '.').' masuk ke saldo Anda.',
            ['milestone_id' => $milestone->id]);
        $this->notifications->notify(User::query()->whereIn('id', $mentorIds)->get(), 'MILESTONE_APPROVED', 'Komisi review masuk',
            "Milestone \"{$milestone->title}\" disetujui UMKM. Komisi review masuk ke saldo Anda.", ['milestone_id' => $milestone->id]);

        $next = Milestone::query()
            ->where('contract_id', $contract->id)
            ->where('sequence', '>', $milestone->sequence)
            ->orderBy('sequence')
            ->lockForUpdate()
            ->first();

        if ($next) {
            $this->openMilestone($next);

            return;
        }

        $this->contracts->transition($contract, 'COMPLETED');
        $contract->completed_at = now();
        $contract->save();

        // Terbitkan sertifikat + portofolio terverifikasi, minta rating.
        $this->certificates->issueForCompletedContract($contract);

        $project = Project::query()->lockForUpdate()->find($contract->project_id);
        if ($project && $project->status === 'ASSIGNED') {
            $this->projects->transition($project, 'COMPLETED');
            $project->save();
        }
    }

    /** Notifikasi & penjadwalan setelah keputusan mentor (07 bagian 3). */
    private function notifyAfterMentorReview(Contract $contract, Milestone $milestone): void
    {
        $student = User::query()->find($contract->student_id);
        $data = ['milestone_id' => $milestone->id];

        if ($milestone->status === 'CLIENT_REVIEW') {
            $this->scheduler->clientReviewStarted($milestone);
            $this->notifications->notify(User::query()->find($contract->umkm_id), 'RESULT_READY_FOR_REVIEW', 'Hasil kerja siap direview',
                "Hasil milestone \"{$milestone->title}\" sudah dicek mentor dan siap Anda review.", $data, [NotificationService::WHATSAPP]);

            return;
        }

        if ($milestone->status === 'ESCALATED') {
            $this->notifications->notify($student, 'MENTOR_RETURN_LIMIT', 'Milestone ditinjau admin',
                "Milestone \"{$milestone->title}\" sudah 3 kali dikembalikan mentor. Admin akan meninjau.", $data);
            $this->notifications->notifyAdmins('ADMIN_ALERT', 'Milestone 3x dikembalikan mentor',
                "Milestone \"{$milestone->title}\" mencapai batas pengembalian mentor.", $data, [NotificationService::IN_APP]);

            return;
        }

        $this->notifications->notify($student, 'MENTOR_RETURNED', 'Mentor mengembalikan pekerjaan',
            "Mentor meminta perbaikan untuk milestone \"{$milestone->title}\" (pengembalian ke-{$milestone->mentor_return_count}).", $data);
    }

    /** @return array{0: Contract, 1: Milestone} */
    private function lockContractAndMilestone(Milestone $milestone): array
    {
        $contract = Contract::query()->lockForUpdate()->findOrFail($milestone->contract_id);
        $milestone = Milestone::query()->lockForUpdate()->findOrFail($milestone->id);

        return [$contract, $milestone];
    }

    /** Hanya submission terbaru dengan status yang diharapkan yang boleh direview. */
    private function lockLatestSubmission(Milestone $milestone, Submission $submission, string $expectedStatus): Submission
    {
        $locked = Submission::query()
            ->where('milestone_id', $milestone->id)
            ->lockForUpdate()
            ->findOrFail($submission->id);

        $latestVersion = (int) Submission::query()->where('milestone_id', $milestone->id)->max('version_no');

        if ($locked->status !== $expectedStatus || $locked->version_no !== $latestVersion) {
            throw new InvalidStateTransition('This submission is not awaiting this review.', [
                'submission_status' => $locked->status,
                'expected_status' => $expectedStatus,
            ]);
        }

        return $locked;
    }

    private function assertStudentOwner(Milestone $milestone, User $user): void
    {
        if ($milestone->contract()->value('student_id') !== $user->id) {
            throw new AuthorizationException('Only the contracted student can submit work.');
        }
    }

    private function assertUmkmOwner(Milestone $milestone, User $user): void
    {
        if ($milestone->contract()->value('umkm_id') !== $user->id) {
            throw new AuthorizationException('Only the project owner can review this submission.');
        }
    }

    private function milestoneSnapshot(Milestone $milestone): array
    {
        return [
            'status' => $milestone->status,
            'revision_count' => $milestone->revision_count,
            'mentor_return_count' => $milestone->mentor_return_count,
        ];
    }
}
