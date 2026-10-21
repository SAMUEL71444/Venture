<?php

namespace App\Modules\auth\State;

use App\Shared\Exceptions\InvalidStateTransition;
use Illuminate\Database\Eloquent\Model;

final class VerificationStateMachine
{
    private const TRANSITIONS = [
        'PENDING' => ['VERIFIED', 'REJECTED'],
        'VERIFIED' => [],
        // Pengajuan ulang setelah ditolak (dibatasi jumlahnya di VerificationController@uploadKtm).
        'REJECTED' => ['PENDING'],
    ];

    public function transition(Model $profile, string $to): void
    {
        $from = $profile->verification_status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Verification status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $profile->verification_status = $to;
    }
}
