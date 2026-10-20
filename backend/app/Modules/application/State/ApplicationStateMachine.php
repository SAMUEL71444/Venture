<?php

namespace App\Modules\application\State;

use App\Models\Application;
use App\Shared\Exceptions\InvalidStateTransition;

/**
 * Status lamaran (ERD APPLICATIONS.status). State diagram tidak punya diagram khusus
 * lamaran; transisi diturunkan dari sequence diagram bagian 1 (lihat DECISIONS.md D2-3).
 */
final class ApplicationStateMachine
{
    public const OPEN_STATUSES = ['PENDING', 'SHORTLISTED'];

    private const TRANSITIONS = [
        'PENDING' => ['SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
        'SHORTLISTED' => ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
        'ACCEPTED' => [],
        'REJECTED' => [],
        'WITHDRAWN' => [],
    ];

    public function transition(Application $application, string $to): void
    {
        $from = $application->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Application status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $application->status = $to;
    }
}
