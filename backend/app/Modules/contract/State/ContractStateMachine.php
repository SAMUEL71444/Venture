<?php

namespace App\Modules\contract\State;

use App\Models\Contract;
use App\Shared\Exceptions\InvalidStateTransition;

/** Transisi Contract sesuai 04-state-diagram.md bagian 2. */
final class ContractStateMachine
{
    private const TRANSITIONS = [
        'AWAITING_PAYMENT' => ['FUNDED', 'CANCELLED'],
        'FUNDED' => ['IN_PROGRESS', 'CANCELLED'],
        'IN_PROGRESS' => ['CANCELLATION_REQUESTED', 'COMPLETED'],
        'CANCELLATION_REQUESTED' => ['IN_PROGRESS', 'TERMINATED'],
        'COMPLETED' => [],
        'CANCELLED' => [],
        'TERMINATED' => [],
    ];

    public function transition(Contract $contract, string $to): void
    {
        $from = $contract->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Contract status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $contract->status = $to;
    }

    /** Semua aksi milestone hanya boleh saat kontrak IN_PROGRESS (dibekukan saat CANCELLATION_REQUESTED). */
    public function assertWorkAllowed(Contract $contract): void
    {
        if ($contract->status !== 'IN_PROGRESS') {
            throw new InvalidStateTransition('Milestone actions are only allowed while the contract is IN_PROGRESS.', [
                'contract_status' => $contract->status,
            ]);
        }
    }
}
