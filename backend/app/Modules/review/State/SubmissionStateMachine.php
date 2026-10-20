<?php

namespace App\Modules\review\State;

use App\Models\Submission;
use App\Shared\Exceptions\InvalidStateTransition;

/**
 * Status submission (ERD SUBMISSIONS.status). Mengikuti alur milestone di
 * 04-state-diagram.md bagian 3: setiap submission melewati mentor dulu.
 */
final class SubmissionStateMachine
{
    private const TRANSITIONS = [
        'PENDING_MENTOR' => ['RETURNED_BY_MENTOR', 'PENDING_CLIENT'],
        'PENDING_CLIENT' => ['REVISION_REQUESTED', 'ACCEPTED'],
        // Keputusan admin setelah milestone ESCALATED: teruskan ke UMKM atau force approve (D6-7).
        'RETURNED_BY_MENTOR' => ['PENDING_CLIENT', 'ACCEPTED'],
        'REVISION_REQUESTED' => [],
        'ACCEPTED' => [],
    ];

    public function transition(Submission $submission, string $to): void
    {
        $from = $submission->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Submission status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $submission->status = $to;
    }
}
