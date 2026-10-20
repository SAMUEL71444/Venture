<?php

namespace App\Modules\admin\State;

use App\Models\AdminAlert;
use App\Shared\Exceptions\InvalidStateTransition;

/**
 * Status admin_alerts. UMKM_UNRESPONSIVE mengikuti 04-state-diagram.md bagian 7 (wajib follow up
 * sebelum AWAITING_DECISION). Tipe lain tidak punya follow up: OPEN -> AWAITING_DECISION / RESOLVED
 * (DECISIONS D6-11). Kenaikan severity bukan transisi status.
 */
final class AdminAlertStateMachine
{
    private const UMKM_UNRESPONSIVE = [
        'OPEN' => ['FOLLOWED_UP', 'RESOLVED'],
        'FOLLOWED_UP' => ['FOLLOWED_UP', 'AWAITING_DECISION', 'RESOLVED'],
        'AWAITING_DECISION' => ['RESOLVED'],
        'RESOLVED' => [],
    ];

    private const GENERIC = [
        'OPEN' => ['AWAITING_DECISION', 'RESOLVED'],
        'AWAITING_DECISION' => ['RESOLVED'],
        'RESOLVED' => [],
    ];

    public function transition(AdminAlert $alert, string $to): void
    {
        $from = $alert->status;
        $rules = $alert->type === 'UMKM_UNRESPONSIVE' ? self::UMKM_UNRESPONSIVE : self::GENERIC;

        if (! in_array($to, $rules[$from] ?? [], true)) {
            throw new InvalidStateTransition("Admin alert status cannot transition from {$from} to {$to}.", [
                'type' => $alert->type,
                'from' => $from,
                'to' => $to,
            ]);
        }

        $alert->status = $to;
    }
}
