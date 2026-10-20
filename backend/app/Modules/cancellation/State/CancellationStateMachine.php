<?php

namespace App\Modules\cancellation\State;

use App\Models\CancellationRequest;
use App\Shared\Exceptions\InvalidStateTransition;

/** Status cancellation_requests (04-state-diagram.md bagian 5). */
final class CancellationStateMachine
{
    private const TRANSITIONS = [
        'PENDING' => ['PENDING', 'WITHDRAWN', 'REJECTED', 'APPROVED'],
        'WITHDRAWN' => [],
        'REJECTED' => [],
        'APPROVED' => [],
    ];

    public function transition(CancellationRequest $request, string $to): void
    {
        $from = $request->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Cancellation request cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $request->status = $to;
    }
}
