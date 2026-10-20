<?php

namespace App\Modules\ledger\State;

use App\Models\Escrow;
use App\Shared\Exceptions\InvalidStateTransition;

/**
 * Status escrow (04-state-diagram.md bagian 4). HELD -> RELEASED ditambahkan untuk kontrak
 * satu milestone: pencairan pertama sekaligus terakhir membuat held_amount = 0 (DECISIONS D3-6).
 */
final class EscrowStateMachine
{
    private const TRANSITIONS = [
        'PENDING_FUNDING' => ['HELD'],
        'HELD' => ['PARTIALLY_RELEASED', 'RELEASED', 'REFUNDED', 'SETTLED'],
        'PARTIALLY_RELEASED' => ['PARTIALLY_RELEASED', 'RELEASED', 'SETTLED'],
        'RELEASED' => [],
        'REFUNDED' => [],
        'SETTLED' => [],
    ];

    public function transition(Escrow $escrow, string $to): void
    {
        $from = $escrow->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Escrow status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $escrow->status = $to;
    }
}
