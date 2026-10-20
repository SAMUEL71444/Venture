<?php

namespace App\Modules\application\State;

use App\Models\Invitation;
use App\Shared\Exceptions\InvalidStateTransition;

/** Status undangan (ERD INVITATIONS.status). */
final class InvitationStateMachine
{
    private const TRANSITIONS = [
        'PENDING' => ['ACCEPTED', 'DECLINED', 'EXPIRED'],
        'ACCEPTED' => [],
        'DECLINED' => [],
        'EXPIRED' => [],
    ];

    public function transition(Invitation $invitation, string $to): void
    {
        $from = $invitation->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Invitation status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $invitation->status = $to;
    }
}
