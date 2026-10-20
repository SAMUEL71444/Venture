<?php

namespace App\Modules\auth\State;

use App\Models\User;
use App\Shared\Exceptions\InvalidStateTransition;

final class UserStateMachine
{
    private const TRANSITIONS = [
        'PENDING_VERIFICATION' => ['ACTIVE'],
        'ACTIVE' => ['SUSPENDED'],
        'SUSPENDED' => [],
    ];

    public function transition(User $user, string $to): void
    {
        $from = $user->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("User status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $user->status = $to;
    }
}
