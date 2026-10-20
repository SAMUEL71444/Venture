<?php

namespace App\Modules\project\State;

use App\Models\PremiumListing;
use App\Shared\Exceptions\InvalidStateTransition;

/** Status premium_listings (ERD): PENDING_PAYMENT -> ACTIVE -> EXPIRED; tagihan tidak dibayar -> EXPIRED. */
final class PremiumListingStateMachine
{
    private const TRANSITIONS = [
        'PENDING_PAYMENT' => ['ACTIVE', 'EXPIRED'],
        'ACTIVE' => ['EXPIRED'],
        'EXPIRED' => [],
    ];

    public function transition(PremiumListing $listing, string $to): void
    {
        $from = $listing->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Premium listing cannot transition from {$from} to {$to}.", ['from' => $from, 'to' => $to]);
        }

        $listing->status = $to;
    }
}
