<?php

namespace App\Console\Commands;

use App\Models\AdminAlert;
use App\Models\CancellationRequest;
use App\Models\Contract;
use App\Models\Invitation;
use App\Models\Milestone;
use App\Models\PremiumListing;
use App\Models\Project;
use App\Modules\scheduler\Services\SchedulerChecks;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Cron harian sebagai jaring pengaman delayed job (07 bagian 1). Memindai semua entitas yang
 * mungkin jatuh tempo; setiap pengecekan idempotent sehingga aman dijalankan berulang.
 */
final class SchedulerSweepCommand extends Command
{
    protected $signature = 'scheduler:sweep';

    protected $description = 'Run all scheduled reminder & escalation checks (safety net for delayed jobs)';

    public function handle(SchedulerChecks $checks): int
    {
        $targets = [
            SchedulerPlanner::CONTRACT_START => Contract::query()->where('status', 'FUNDED')->pluck('id'),
            SchedulerPlanner::MENTOR_SLA => Milestone::query()->where('status', 'MENTOR_REVIEW')->pluck('id'),
            SchedulerPlanner::CLIENT_REVIEW => Milestone::query()->where('status', 'CLIENT_REVIEW')->pluck('id'),
            SchedulerPlanner::MILESTONE_DEADLINE => Milestone::query()->where('status', 'IN_PROGRESS')->whereNotNull('due_date')->pluck('id'),
            SchedulerPlanner::ALERT_FOLLOW_UP_SLA => AdminAlert::query()->where('type', 'UMKM_UNRESPONSIVE')->where('status', 'OPEN')->pluck('id'),
            SchedulerPlanner::FOLLOW_UP_DEADLINE => AdminAlert::query()->where('type', 'UMKM_UNRESPONSIVE')->where('status', 'FOLLOWED_UP')
                ->where('follow_up_deadline', '<=', now())->pluck('id'),
            SchedulerPlanner::CANCELLATION_RESPONSE => CancellationRequest::query()->where('status', 'PENDING')
                ->where('response_due_at', '<=', now())->pluck('id'),
            SchedulerPlanner::PREMIUM_LISTING => PremiumListing::query()->where('status', 'ACTIVE')
                ->where('ends_at', '<=', now()->addDays((int) app(PlatformSettingsService::class)->int('premium_reminder_days_before')))->pluck('id'),
            SchedulerPlanner::INVITATION_EXPIRE => Invitation::query()->where('status', 'PENDING')->where('expires_at', '<=', now())->pluck('id'),
            SchedulerPlanner::PROJECT_DEADLINE => Project::query()->where('status', 'OPEN')->whereNotNull('deadline')
                ->where('deadline', '<', now()->timezone(config('app.business_timezone'))->toDateString())->pluck('id'),
        ];

        $failures = 0;
        foreach ($targets as $check => $ids) {
            foreach ($ids as $id) {
                try {
                    $checks->run($check, $id);
                } catch (Throwable $exception) {
                    // Satu entitas gagal tidak boleh menghentikan sweep untuk entitas lain.
                    $failures++;
                    Log::error('scheduler.sweep.failed', ['check' => $check, 'id' => $id, 'error' => $exception->getMessage()]);
                }
            }

            $this->line(sprintf('%-20s %d checked', $check, count($ids)));
        }

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }
}
