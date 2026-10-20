<?php

namespace App\Modules\payout\State;

use App\Models\Payout;
use App\Shared\Exceptions\InvalidStateTransition;

/** Status payout (04-state-diagram.md bagian 6). REQUESTED -> FAILED jika gateway menolak saat pengiriman. */
final class PayoutStateMachine
{
    private const TRANSITIONS = [
        'REQUESTED' => ['PROCESSING', 'FAILED'],
        'PROCESSING' => ['SUCCESS', 'FAILED'],
        'SUCCESS' => [],
        'FAILED' => [],
    ];

    public function transition(Payout $payout, string $to): void
    {
        $from = $payout->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Payout status cannot transition from {$from} to {$to}.", ['from' => $from, 'to' => $to]);
        }

        $payout->status = $to;
    }
}
