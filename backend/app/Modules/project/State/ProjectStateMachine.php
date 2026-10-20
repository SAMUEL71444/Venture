<?php

namespace App\Modules\project\State;

use App\Models\Project;
use App\Shared\Exceptions\InvalidStateTransition;

final class ProjectStateMachine
{
    private const TRANSITIONS = [
        'DRAFT' => ['OPEN', 'CANCELLED'],
        'OPEN' => ['ASSIGNED', 'CLOSED', 'CANCELLED'],
        'ASSIGNED' => ['OPEN', 'COMPLETED', 'CANCELLED'],
        'COMPLETED' => [],
        'CANCELLED' => [],
        'CLOSED' => [],
    ];

    public function transition(Project $project, string $to): void
    {
        $from = $project->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Project status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $project->status = $to;
    }
}
