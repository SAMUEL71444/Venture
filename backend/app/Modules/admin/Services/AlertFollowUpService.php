<?php

namespace App\Modules\admin\Services;

use App\Models\AdminAlert;
use App\Models\AlertFollowUp;
use App\Models\Contract;
use App\Models\Milestone;
use App\Models\User;
use App\Modules\admin\State\AdminAlertStateMachine;
use App\Modules\notification\Services\NotificationService;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Settings\PlatformSettingsService;

/**
 * Admin mencatat follow up UMKM yang tidak merespons (05-sequence-diagram.md bagian 6,
 * 04-state-diagram.md bagian 7). Follow up pertama memulai batas 7 hari; follow up
 * tambahan tidak menggeser deadline.
 */
final class AlertFollowUpService
{
    public const CHANNELS = ['WHATSAPP', 'TELEPON', 'EMAIL'];

    public const OUTCOMES = ['TIDAK_DIANGKAT', 'DIJAWAB_AKAN_REVIEW', 'DIJAWAB_MENOLAK', 'LAINNYA'];

    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly AdminAlertStateMachine $alerts,
        private readonly PlatformSettingsService $settings,
        private readonly SchedulerPlanner $scheduler,
        private readonly NotificationService $notifications,
        private readonly AuditLogger $audit,
    ) {}

    public function record(AdminAlert $alert, User $admin, string $channel, string $outcome, ?string $notes, ?string $ip = null): AdminAlert
    {
        return $this->transactions->run(function () use ($alert, $admin, $channel, $outcome, $notes, $ip) {
            $alert = AdminAlert::query()->lockForUpdate()->findOrFail($alert->id);

            if ($alert->type !== 'UMKM_UNRESPONSIVE') {
                throw new BusinessRuleViolation('Follow ups are only recorded for UMKM_UNRESPONSIVE alerts.', ['type' => $alert->type]);
            }

            $before = $alert->only(['status', 'follow_up_deadline', 'assigned_to']);
            $isFirst = $alert->status === 'OPEN';

            // OPEN -> FOLLOWED_UP, FOLLOWED_UP -> FOLLOWED_UP; selain itu 409.
            $this->alerts->transition($alert, 'FOLLOWED_UP');
            if ($isFirst) {
                $alert->follow_up_deadline = now()->addDays($this->settings->int('umkm_followup_deadline_days'));
            }
            $alert->assigned_to ??= $admin->id;
            $alert->save();

            $followUp = AlertFollowUp::query()->create([
                'alert_id' => $alert->id,
                'admin_id' => $admin->id,
                'channel' => $channel,
                'outcome' => $outcome,
                'notes' => $notes,
                'followed_up_at' => now(),
            ]);

            $this->audit->log($admin, 'ALERT_FOLLOWED_UP', $alert, $before, [
                ...$alert->only(['status', 'follow_up_deadline', 'assigned_to']),
                'follow_up_id' => $followUp->id,
                'channel' => $channel,
                'outcome' => $outcome,
            ], $ip);

            if ($isFirst) {
                $this->scheduler->followUpRecorded($alert);
                $this->notifyParties($alert);
            }

            return $alert->load('followUps');
        });
    }

    /** "Admin sudah follow up, batas 7 hari dimulai" -> UMKM & mahasiswa (WA, In-app). */
    private function notifyParties(AdminAlert $alert): void
    {
        $contract = Contract::query()->find(Milestone::query()->whereKey($alert->reference_id)->value('contract_id'));
        if (! $contract) {
            return;
        }

        $deadline = $alert->follow_up_deadline->timezone(config('app.business_timezone'))->format('d-m-Y');
        $users = User::query()->whereIn('id', [$contract->umkm_id, $contract->student_id])->get();

        $this->notifications->notify($users, 'FOLLOW_UP_STARTED', 'Admin menindaklanjuti review',
            "Admin sudah menghubungi UMKM terkait review kontrak {$contract->contract_no}. Batas respons sampai {$deadline}.",
            ['alert_id' => $alert->id, 'contract_id' => $contract->id], [NotificationService::WHATSAPP]);
    }
}
