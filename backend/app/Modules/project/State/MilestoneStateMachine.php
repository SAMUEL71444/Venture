<?php

namespace App\Modules\project\State;

use App\Models\Milestone;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;

final class MilestoneStateMachine
{
    private const TRANSITIONS = [
        'LOCKED' => ['IN_PROGRESS'],
        'IN_PROGRESS' => ['MENTOR_REVIEW'],
        'MENTOR_REVIEW' => ['CLIENT_REVIEW', 'IN_PROGRESS', 'ESCALATED'],
        'CLIENT_REVIEW' => ['APPROVED', 'REVISION_REQUESTED', 'ESCALATED'],
        'REVISION_REQUESTED' => ['IN_PROGRESS'],
        'ESCALATED' => ['APPROVED', 'IN_PROGRESS', 'CLIENT_REVIEW', 'CANCELLED'],
        'APPROVED' => [],
        'CANCELLED' => [],
    ];

    public function transition(Milestone $milestone, string $to): void
    {
        $from = $milestone->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Milestone status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $milestone->status = $to;
    }

    /**
     * Kontrak TERMINATED: semua milestone yang belum selesai menjadi CANCELLED
     * (05-sequence-diagram.md bagian 4 "milestone sisa CANCELLED"; DECISIONS D6-5).
     */
    public function cancelForTermination(Milestone $milestone): void
    {
        if (in_array($milestone->status, ['APPROVED', 'CANCELLED'], true)) {
            throw new InvalidStateTransition("Milestone status cannot transition from {$milestone->status} to CANCELLED.", [
                'from' => $milestone->status,
                'to' => 'CANCELLED',
            ]);
        }

        $milestone->status = 'CANCELLED';
    }

    public function assertRevisionAllowed(Milestone $milestone): void
    {
        if ($milestone->status !== 'CLIENT_REVIEW') {
            throw new InvalidStateTransition('Milestone is not awaiting client review.');
        }

        if ($milestone->revision_count >= $milestone->max_revisions) {
            throw new BusinessRuleViolation('Revision limit reached for this milestone.', [
                'revision_count' => $milestone->revision_count,
                'max_revisions' => $milestone->max_revisions,
            ]);
        }
    }
}
