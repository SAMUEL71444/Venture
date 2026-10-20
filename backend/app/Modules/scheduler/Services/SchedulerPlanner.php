<?php

namespace App\Modules\scheduler\Services;

use App\Models\AdminAlert;
use App\Models\CancellationRequest;
use App\Models\Contract;
use App\Models\Invitation;
use App\Models\Milestone;
use App\Models\PremiumListing;
use App\Models\Project;
use App\Models\Submission;
use App\Shared\Settings\PlatformSettingsService;
use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Menjadwalkan delayed job pada saat event terjadi (07 bagian 1). Semua jeda dibaca dari
 * platform_settings. Cron harian `scheduler:sweep` menjadi jaring pengaman jika job hilang.
 */
final class SchedulerPlanner
{
    public const CONTRACT_START = 'contract-start';

    public const MENTOR_SLA = 'mentor-sla';

    public const CLIENT_REVIEW = 'client-review';

    public const ALERT_FOLLOW_UP_SLA = 'alert-followup-sla';

    public const FOLLOW_UP_DEADLINE = 'followup-deadline';

    public const MILESTONE_DEADLINE = 'milestone-deadline';

    public const INVITATION_EXPIRE = 'invitation-expire';

    public const PROJECT_DEADLINE = 'project-deadline';

    public const CANCELLATION_RESPONSE = 'cancellation-response';

    public const PREMIUM_LISTING = 'premium-listing';

    public function __construct(
        private readonly ScheduledCheckDispatcher $dispatcher,
        private readonly PlatformSettingsService $settings,
    ) {}

    /** start-reminder 24/72 jam + student-not-started hari ke-7 setelah FUNDED. */
    public function contractFunded(Contract $contract): void
    {
        $base = CarbonImmutable::instance($contract->funded_at ?? now());
        $times = array_map(fn (int $hours) => $base->addHours($hours), $this->settings->intList('start_reminder_hours'));
        $times[] = $base->addDays($this->settings->int('student_not_started_alert_days'));

        $this->dispatcher->at(self::CONTRACT_START, $contract->id, $times);
    }

    /** mentor-sla: reminder 48 jam, alert MENTOR_OVERDUE 72 jam. */
    public function submissionCreated(Milestone $milestone, Submission $submission): void
    {
        $this->mentorReviewStarted($milestone, $submission->submitted_at ?? now());
    }

    /** SLA mentor dihitung ulang saat mentor diganti (dari waktu penugasan mentor baru). */
    public function mentorReviewStarted(Milestone $milestone, DateTimeInterface $since): void
    {
        $base = CarbonImmutable::instance($since);

        $this->dispatcher->at(self::MENTOR_SLA, $milestone->id, [
            $base->addHours($this->settings->int('mentor_sla_hours')),
            $base->addHours($this->settings->int('mentor_overdue_alert_hours')),
        ]);
    }

    /** client-review-reminder H+3/H+7/H+10 + umkm-unresponsive H+14. */
    public function clientReviewStarted(Milestone $milestone): void
    {
        // Jeda selama CANCELLATION_REQUESTED menggeser semua ambang (07 bagian 2).
        $base = CarbonImmutable::instance($milestone->client_review_started_at ?? now())->addSeconds((int) $milestone->client_review_paused_seconds);
        $times = array_map(fn (int $days) => $base->addDays($days), $this->settings->intList('umkm_review_reminder_days'));
        $times[] = $base->addDays($this->settings->int('umkm_unresponsive_alert_days'));

        $this->dispatcher->at(self::CLIENT_REVIEW, $milestone->id, $times);
    }

    /** admin-followup-sla: 2 hari setelah alert UMKM_UNRESPONSIVE dibuat. */
    public function unresponsiveAlertOpened(AdminAlert $alert): void
    {
        $this->dispatcher->at(self::ALERT_FOLLOW_UP_SLA, $alert->id, [
            CarbonImmutable::instance($alert->created_at ?? now())->addDays($this->settings->int('admin_followup_sla_days')),
        ]);
    }

    /** followup-deadline: 7 hari setelah follow up pertama. */
    public function followUpRecorded(AdminAlert $alert): void
    {
        if ($alert->follow_up_deadline) {
            $this->dispatcher->at(self::FOLLOW_UP_DEADLINE, $alert->id, [$alert->follow_up_deadline]);
        }
    }

    /** milestone-deadline: H-2, H+0, dan H+3 (alert STUDENT_OVERDUE) dari due date. */
    public function milestoneOpened(Milestone $milestone): void
    {
        if (! $milestone->due_date) {
            return;
        }

        $due = self::businessDayStart($milestone->due_date);

        $this->dispatcher->at(self::MILESTONE_DEADLINE, $milestone->id, [
            $due->subDays($this->settings->int('milestone_due_reminder_days_before')),
            $due,
            $due->addDays($this->settings->int('student_overdue_alert_days')),
        ]);
    }

    /** cancellation-response: 3 hari setelah pengajuan, siap diputuskan admin. */
    public function cancellationRequested(CancellationRequest $request): void
    {
        if ($request->response_due_at) {
            $this->dispatcher->at(self::CANCELLATION_RESPONSE, $request->id, [$request->response_due_at]);
        }
    }

    /** premium-reminder (3 hari sebelum habis) dan premium-expire (ends_at). */
    public function premiumListingActivated(PremiumListing $listing): void
    {
        $endsAt = CarbonImmutable::instance($listing->ends_at);

        $this->dispatcher->at(self::PREMIUM_LISTING, $listing->id, [
            $endsAt->subDays($this->settings->int('premium_reminder_days_before')),
            $endsAt,
        ]);
    }

    public function invitationCreated(Invitation $invitation): void
    {
        $this->dispatcher->at(self::INVITATION_EXPIRE, $invitation->id, [$invitation->expires_at]);
    }

    /** Project OPEN -> CLOSED setelah hari deadline berakhir tanpa kontrak. */
    public function projectPublished(Project $project): void
    {
        if ($project->deadline) {
            $this->dispatcher->at(self::PROJECT_DEADLINE, $project->id, [self::businessDayStart($project->deadline)->addDay()]);
        }
    }

    /** Awal hari (00:00) sebuah tanggal di zona waktu bisnis, dalam UTC. */
    public static function businessDayStart(DateTimeInterface|string $date): CarbonImmutable
    {
        $dateString = $date instanceof DateTimeInterface ? $date->format('Y-m-d') : $date;

        return CarbonImmutable::parse($dateString, config('app.business_timezone'))->startOfDay()->utc();
    }
}
