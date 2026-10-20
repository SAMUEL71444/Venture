<?php

namespace App\Modules\scheduler\Services;

use App\Models\AdminAlert;
use App\Models\AlertFollowUp;
use App\Models\Application;
use App\Models\CancellationRequest;
use App\Models\Contract;
use App\Models\Invitation;
use App\Models\Milestone;
use App\Models\PremiumListing;
use App\Models\Project;
use App\Models\Submission;
use App\Models\User;
use App\Modules\admin\Services\AdminAlertService;
use App\Modules\admin\State\AdminAlertStateMachine;
use App\Modules\application\State\ApplicationStateMachine;
use App\Modules\application\State\InvitationStateMachine;
use App\Modules\notification\Services\NotificationService;
use App\Modules\project\State\MilestoneStateMachine;
use App\Modules\project\State\PremiumListingStateMachine;
use App\Modules\project\State\ProjectStateMachine;
use App\Modules\review\Services\MentorAssignmentService;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Settings\PlatformSettingsService;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Pengecekan terjadwal (07-scheduler-dan-notifikasi.md). Setiap pengecekan:
 * - mengunci entitas lalu mengecek ulang status & waktu (status bisa sudah berubah),
 * - hanya berjalan saat kontrak IN_PROGRESS untuk timer milestone (dijeda saat CANCELLATION_REQUESTED),
 * - menjalankan setiap aksi sekali saja lewat scheduler_action_logs (aman dipanggil job & cron berulang).
 */
final class SchedulerChecks
{
    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly PlatformSettingsService $settings,
        private readonly NotificationService $notifications,
        private readonly AdminAlertService $alerts,
        private readonly AdminAlertStateMachine $alertStates,
        private readonly MilestoneStateMachine $milestones,
        private readonly ProjectStateMachine $projects,
        private readonly ApplicationStateMachine $applications,
        private readonly InvitationStateMachine $invitations,
        private readonly MentorAssignmentService $assignments,
        private readonly SchedulerPlanner $planner,
        private readonly AuditLogger $audit,
        private readonly PremiumListingStateMachine $premiumListings,
    ) {}

    public function run(string $check, string $entityId): void
    {
        match ($check) {
            SchedulerPlanner::CONTRACT_START => $this->contractStart($entityId),
            SchedulerPlanner::MENTOR_SLA => $this->mentorSla($entityId),
            SchedulerPlanner::CLIENT_REVIEW => $this->clientReview($entityId),
            SchedulerPlanner::ALERT_FOLLOW_UP_SLA => $this->alertFollowUpSla($entityId),
            SchedulerPlanner::FOLLOW_UP_DEADLINE => $this->followUpDeadline($entityId),
            SchedulerPlanner::MILESTONE_DEADLINE => $this->milestoneDeadline($entityId),
            SchedulerPlanner::INVITATION_EXPIRE => $this->invitationExpire($entityId),
            SchedulerPlanner::PROJECT_DEADLINE => $this->projectDeadline($entityId),
            SchedulerPlanner::CANCELLATION_RESPONSE => $this->cancellationResponse($entityId),
            SchedulerPlanner::PREMIUM_LISTING => $this->premiumListing($entityId),
            default => throw new InvalidArgumentException("Unknown scheduled check [{$check}]."),
        };
    }

    /** start-reminder (24/72 jam) dan student-not-started (hari ke-7). Tidak ada auto-start. */
    public function contractStart(string $contractId): void
    {
        $this->transactions->run(function () use ($contractId) {
            $contract = Contract::query()->lockForUpdate()->find($contractId);
            if (! $contract || $contract->status !== 'FUNDED' || ! $contract->funded_at) {
                return;
            }

            $base = CarbonImmutable::instance($contract->funded_at);
            $student = User::query()->find($contract->student_id);

            foreach ($this->settings->intList('start_reminder_hours') as $hours) {
                if ($this->isDue($base->addHours($hours))) {
                    $this->once("contract:{$contract->id}:start-reminder:{$hours}h", 'CONTRACT', $contract->id, fn () => $this->notifications->notify(
                        $student, 'START_REMINDER', 'Dana sudah aman di escrow',
                        "Dana kontrak {$contract->contract_no} sudah masuk escrow. Klik Mulai Kerja untuk memulai pengerjaan.",
                        ['contract_id' => $contract->id], [NotificationService::WHATSAPP],
                    ));
                }
            }

            if ($this->isDue($base->addDays($this->settings->int('student_not_started_alert_days')))) {
                $this->once("contract:{$contract->id}:student-not-started", 'CONTRACT', $contract->id, function () use ($contract) {
                    $this->notifications->notify(
                        User::query()->find($contract->umkm_id), 'STUDENT_NOT_STARTED', 'Mahasiswa belum mulai bekerja',
                        "Mahasiswa belum memulai kontrak {$contract->contract_no}. Anda bisa membatalkan langsung dengan pengembalian nilai project penuh.",
                        ['contract_id' => $contract->id], [NotificationService::WHATSAPP],
                    );
                    $alert = $this->alerts->open('STUDENT_NOT_STARTED', 'MEDIUM', 'CONTRACT', $contract->id);
                    $this->notifyAdminsAboutAlert($alert, 'Mahasiswa belum klik Mulai Kerja');
                });
            }
        });
    }

    /** mentor-sla: reminder ke mentor (48 jam), alert MENTOR_OVERDUE (72 jam). */
    public function mentorSla(string $milestoneId): void
    {
        $this->withActiveMilestone($milestoneId, function (Contract $contract, Milestone $milestone) {
            if ($milestone->status !== 'MENTOR_REVIEW') {
                return;
            }

            $submission = Submission::query()->where('milestone_id', $milestone->id)
                ->where('status', 'PENDING_MENTOR')->orderByDesc('version_no')->first();
            if (! $submission?->submitted_at) {
                return;
            }

            $assignment = $this->assignments->activeAssignment($milestone);
            // Mentor pengganti mendapat SLA penuh sejak ditugaskan.
            $base = CarbonImmutable::instance(max($submission->submitted_at, $assignment?->assigned_at ?? $submission->submitted_at));
            $cycle = $submission->id.($assignment ? ':'.$assignment->id : '');

            if ($assignment && $this->isDue($base->addHours($this->settings->int('mentor_sla_hours')))) {
                $this->once("submission:{$cycle}:mentor-sla-reminder", 'MILESTONE', $milestone->id, fn () => $this->notifications->notify(
                    User::query()->find($assignment->mentor_id), 'MENTOR_REVIEW_REMINDER', 'Submission menunggu review',
                    "Submission milestone \"{$milestone->title}\" sudah menunggu review Anda.",
                    ['milestone_id' => $milestone->id, 'submission_id' => $submission->id], [NotificationService::EMAIL],
                ));
            }

            // Tanpa mentor aktif (tidak ada mentor tersedia) langsung dianggap terlambat pada batas SLA.
            $alertAt = $assignment
                ? $base->addHours($this->settings->int('mentor_overdue_alert_hours'))
                : $base->addHours($this->settings->int('mentor_sla_hours'));

            if ($this->isDue($alertAt)) {
                $this->once("submission:{$cycle}:mentor-overdue", 'MILESTONE', $milestone->id, function () use ($milestone) {
                    $alert = $this->alerts->open('MENTOR_OVERDUE', 'MEDIUM', 'MILESTONE', $milestone->id);
                    $this->notifyAdminsAboutAlert($alert, 'Mentor melewati SLA review');
                });
            }
        });
    }

    /** client-review-reminder H+3/H+7/H+10 dan umkm-unresponsive H+14. Milestone tetap CLIENT_REVIEW. */
    public function clientReview(string $milestoneId): void
    {
        $this->withActiveMilestone($milestoneId, function (Contract $contract, Milestone $milestone) {
            if ($milestone->status !== 'CLIENT_REVIEW' || ! $milestone->client_review_started_at) {
                return;
            }

            $cycle = CarbonImmutable::instance($milestone->client_review_started_at)->getTimestamp();
            $base = CarbonImmutable::instance($milestone->client_review_started_at)->addSeconds((int) $milestone->client_review_paused_seconds);
            // Siklus review baru (setelah revisi) punya client_review_started_at baru -> kunci baru.
            // Jeda (paused_seconds) menggeser ambang waktu tetapi tidak mengubah siklus.
            $umkm = User::query()->find($contract->umkm_id);
            $reminderDays = $this->settings->intList('umkm_review_reminder_days');
            $lastReminder = end($reminderDays);

            foreach ($reminderDays as $days) {
                if ($this->isDue($base->addDays($days))) {
                    $body = $days === $lastReminder
                        ? "Hasil kerja \"{$milestone->title}\" masih menunggu review Anda. Jika belum ada respons, admin akan menghubungi Anda."
                        : "Hasil kerja \"{$milestone->title}\" menunggu review Anda. Silakan approve atau minta revisi.";

                    $this->once("milestone:{$milestone->id}:client-review:{$cycle}:reminder:{$days}", 'MILESTONE', $milestone->id,
                        fn () => $this->notifications->notify($umkm, 'REVIEW_REMINDER', 'Hasil kerja menunggu review', $body,
                            ['milestone_id' => $milestone->id, 'day' => $days], [NotificationService::WHATSAPP]));
                }
            }

            if ($this->isDue($base->addDays($this->settings->int('umkm_unresponsive_alert_days')))) {
                $this->once("milestone:{$milestone->id}:client-review:{$cycle}:unresponsive", 'MILESTONE', $milestone->id, function () use ($milestone) {
                    $alert = $this->alerts->open('UMKM_UNRESPONSIVE', 'MEDIUM', 'MILESTONE', $milestone->id);
                    $this->notifyAdminsAboutAlert($alert, 'UMKM tidak merespons 14 hari, wajib follow up');
                    $this->planner->unresponsiveAlertOpened($alert);
                });
            }
        });
    }

    /** admin-followup-sla: alert OPEN tanpa follow up selama 2 hari -> severity HIGH. */
    public function alertFollowUpSla(string $alertId): void
    {
        $this->transactions->run(function () use ($alertId) {
            $alert = AdminAlert::query()->lockForUpdate()->find($alertId);
            if (! $alert || $alert->type !== 'UMKM_UNRESPONSIVE' || $alert->status !== 'OPEN' || $alert->severity === 'HIGH') {
                return;
            }

            $due = CarbonImmutable::instance($alert->created_at)->addDays($this->settings->int('admin_followup_sla_days'));
            if (! $this->isDue($due) || AlertFollowUp::query()->where('alert_id', $alert->id)->exists()) {
                return;
            }

            $alert->severity = 'HIGH';
            $alert->save();

            $this->notifyAdminsAboutAlert($alert, 'Alert belum di-follow up, severity dinaikkan ke HIGH');
        });
    }

    /** followup-deadline: batas 7 hari lewat dan UMKM tetap diam -> milestone ESCALATED, alert AWAITING_DECISION. */
    public function followUpDeadline(string $alertId): void
    {
        $milestoneId = AdminAlert::query()->whereKey($alertId)->where('reference_type', 'MILESTONE')->value('reference_id');
        $contractId = $milestoneId ? Milestone::query()->whereKey($milestoneId)->value('contract_id') : null;
        if (! $contractId) {
            return;
        }

        $this->transactions->run(function () use ($alertId, $milestoneId, $contractId) {
            $contract = Contract::query()->lockForUpdate()->find($contractId);
            $milestone = Milestone::query()->lockForUpdate()->find($milestoneId);
            $alert = AdminAlert::query()->lockForUpdate()->find($alertId);

            if (! $alert || $alert->type !== 'UMKM_UNRESPONSIVE' || $alert->status !== 'FOLLOWED_UP'
                || ! $alert->follow_up_deadline || ! $this->isDue($alert->follow_up_deadline)) {
                return;
            }

            if ($milestone->status !== 'CLIENT_REVIEW') {
                // UMKM sudah merespons lewat jalur lain; alert tidak relevan lagi.
                $this->alertStates->transition($alert, 'RESOLVED');
                $alert->resolution_notes = 'Milestone sudah tidak menunggu review UMKM.';
                $alert->resolved_at = now();
                $alert->save();

                return;
            }

            if ($contract->status !== 'IN_PROGRESS') {
                return; // Timer dijeda (misal CANCELLATION_REQUESTED).
            }

            $this->milestones->transition($milestone, 'ESCALATED');
            $milestone->save();
            $this->alertStates->transition($alert, 'AWAITING_DECISION');
            $alert->save();

            $this->audit->log(null, 'MILESTONE_ESCALATED_UMKM_UNRESPONSIVE', $milestone,
                ['status' => 'CLIENT_REVIEW'], ['status' => 'ESCALATED', 'admin_alert_id' => $alert->id]);

            $this->notifyAdminsAboutAlert($alert, 'Batas follow up lewat, admin harus memutuskan');
        });
    }

    /** milestone-deadline: reminder H-2 dan H+0 ke mahasiswa, H+3 alert STUDENT_OVERDUE. */
    public function milestoneDeadline(string $milestoneId): void
    {
        $this->withActiveMilestone($milestoneId, function (Contract $contract, Milestone $milestone) {
            if ($milestone->status !== 'IN_PROGRESS' || ! $milestone->due_date) {
                return;
            }

            $due = SchedulerPlanner::businessDayStart($milestone->due_date);
            $dueKey = $milestone->due_date->format('Y-m-d');
            $student = User::query()->find($contract->student_id);

            if ($this->isDue($due)) {
                $this->once("milestone:{$milestone->id}:due:{$dueKey}:today", 'MILESTONE', $milestone->id, fn () => $this->notifications->notify(
                    $student, 'MILESTONE_DUE', 'Deadline milestone hari ini',
                    "Milestone \"{$milestone->title}\" jatuh tempo hari ini.", ['milestone_id' => $milestone->id]));
            } elseif ($this->isDue($due->subDays($this->settings->int('milestone_due_reminder_days_before')))) {
                $this->once("milestone:{$milestone->id}:due:{$dueKey}:before", 'MILESTONE', $milestone->id, fn () => $this->notifications->notify(
                    $student, 'MILESTONE_DUE_SOON', 'Deadline milestone sebentar lagi',
                    "Milestone \"{$milestone->title}\" jatuh tempo pada {$dueKey}.", ['milestone_id' => $milestone->id]));
            }

            if ($this->isDue($due->addDays($this->settings->int('student_overdue_alert_days')))) {
                $this->once("milestone:{$milestone->id}:due:{$dueKey}:overdue", 'MILESTONE', $milestone->id, function () use ($milestone) {
                    $alert = $this->alerts->open('STUDENT_OVERDUE', 'MEDIUM', 'MILESTONE', $milestone->id);
                    $this->notifyAdminsAboutAlert($alert, 'Mahasiswa melewati deadline milestone');
                });
            }
        });
    }

    /** invitation-expire: undangan PENDING lewat expires_at -> EXPIRED. */
    public function invitationExpire(string $invitationId): void
    {
        $this->transactions->run(function () use ($invitationId) {
            $invitation = Invitation::query()->lockForUpdate()->find($invitationId);
            if ($invitation && $invitation->status === 'PENDING' && $this->isDue($invitation->expires_at)) {
                $this->invitations->transition($invitation, 'EXPIRED');
                $invitation->save();
            }
        });
    }

    /** Project OPEN yang deadline-nya lewat tanpa kontrak -> CLOSED (04 bagian 1). */
    public function projectDeadline(string $projectId): void
    {
        $this->transactions->run(function () use ($projectId) {
            $project = Project::query()->lockForUpdate()->find($projectId);
            if (! $project || $project->status !== 'OPEN' || ! $project->deadline
                || ! $this->isDue(SchedulerPlanner::businessDayStart($project->deadline)->addDay())) {
                return;
            }

            $this->projects->transition($project, 'CLOSED');
            $project->closed_at = now();
            $project->save();

            Application::query()->where('project_id', $project->id)
                ->whereIn('status', ApplicationStateMachine::OPEN_STATUSES)->lockForUpdate()->get()
                ->each(function (Application $application) {
                    $this->applications->transition($application, 'REJECTED');
                    $application->save();
                });

            Invitation::query()->where('project_id', $project->id)->where('status', 'PENDING')->lockForUpdate()->get()
                ->each(function (Invitation $invitation) {
                    $this->invitations->transition($invitation, 'EXPIRED');
                    $invitation->save();
                });
        });
    }

    /** cancellation-response: 3 hari lewat -> siap diputuskan admin walau pihak lain belum menanggapi. */
    public function cancellationResponse(string $requestId): void
    {
        $this->transactions->run(function () use ($requestId) {
            $request = CancellationRequest::query()->lockForUpdate()->find($requestId);
            if (! $request || $request->status !== 'PENDING' || ! $request->response_due_at || ! $this->isDue($request->response_due_at)) {
                return;
            }

            $this->once("cancellation:{$request->id}:response-deadline", 'CANCELLATION', $request->id, function () use ($request) {
                $alert = AdminAlert::query()->where('type', 'CANCELLATION_REQUEST')->where('reference_type', 'CANCELLATION')
                    ->where('reference_id', $request->id)->where('status', 'OPEN')->lockForUpdate()->first();
                if ($alert) {
                    $this->alertStates->transition($alert, 'AWAITING_DECISION');
                    $alert->save();
                }

                $this->notifications->notifyAdmins('ADMIN_ALERT', 'Pengajuan pembatalan siap diputuskan',
                    'Batas tanggapan pihak lain sudah lewat'.($request->counterparty_response ? '.' : ' tanpa tanggapan.'),
                    ['cancellation_request_id' => $request->id, 'alert_id' => $alert?->id]);
            });
        });
    }

    /** premium-reminder 3 hari sebelum habis (tawarkan perpanjangan) dan premium-expire saat ends_at. */
    public function premiumListing(string $listingId): void
    {
        $this->transactions->run(function () use ($listingId) {
            $listing = PremiumListing::query()->lockForUpdate()->find($listingId);
            if (! $listing || $listing->status !== 'ACTIVE' || ! $listing->ends_at) {
                return;
            }

            $project = Project::query()->find($listing->project_id);
            $umkm = User::query()->find($project?->umkm_id);
            $endsAt = CarbonImmutable::instance($listing->ends_at);

            if ($this->isDue($endsAt)) {
                $this->premiumListings->transition($listing, 'EXPIRED');
                $listing->save();
                $this->notifications->notify($umkm, 'PREMIUM_EXPIRED', 'Premium listing berakhir',
                    "Premium listing project \"{$project?->title}\" sudah berakhir.", ['premium_listing_id' => $listing->id], [NotificationService::WHATSAPP]);

                return;
            }

            if ($this->isDue($endsAt->subDays($this->settings->int('premium_reminder_days_before')))) {
                $this->once("premium:{$listing->id}:reminder", 'PREMIUM_LISTING', $listing->id, fn () => $this->notifications->notify($umkm,
                    'PREMIUM_EXPIRING', 'Premium listing akan berakhir',
                    "Premium listing project \"{$project?->title}\" berakhir pada ".$endsAt->timezone(config('app.business_timezone'))->format('d-m-Y').'. Perpanjang agar tetap di urutan teratas.',
                    ['premium_listing_id' => $listing->id], [NotificationService::WHATSAPP]));
            }
        });
    }

    /** Kunci contract -> milestone; jalankan hanya jika kontrak IN_PROGRESS (timer dijeda selain itu). */
    private function withActiveMilestone(string $milestoneId, Closure $callback): void
    {
        $contractId = Milestone::query()->whereKey($milestoneId)->value('contract_id');
        if (! $contractId) {
            return;
        }

        $this->transactions->run(function () use ($contractId, $milestoneId, $callback) {
            $contract = Contract::query()->lockForUpdate()->find($contractId);
            $milestone = Milestone::query()->lockForUpdate()->find($milestoneId);

            if ($contract && $milestone && $contract->status === 'IN_PROGRESS') {
                $callback($contract, $milestone);
            }
        });
    }

    /** Jalankan $action sekali untuk $key. Rollback transaksi ikut membatalkan penandanya. */
    private function once(string $key, string $entityType, string $entityId, Closure $action): void
    {
        $inserted = DB::table('scheduler_action_logs')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'action_key' => $key,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'performed_at' => now(),
        ]);

        if ($inserted > 0) {
            $action();
        }
    }

    private function notifyAdminsAboutAlert(AdminAlert $alert, string $title): void
    {
        $this->notifications->notifyAdmins('ADMIN_ALERT', $title, "Alert {$alert->type} ({$alert->severity}) untuk {$alert->reference_type} {$alert->reference_id}.", [
            'alert_id' => $alert->id,
            'alert_type' => $alert->type,
        ]);
    }

    private function isDue(\DateTimeInterface $at): bool
    {
        return now()->greaterThanOrEqualTo($at);
    }
}
