<?php

namespace App\Modules\payment\State;

use App\Models\Payment;
use App\Shared\Exceptions\InvalidStateTransition;

/** Status payment (ERD PAYMENTS.status). REFUNDED dipakai di fase pembatalan. */
final class PaymentStateMachine
{
    private const TRANSITIONS = [
        'PENDING' => ['PAID', 'FAILED', 'EXPIRED'],
        'PAID' => ['REFUNDED'],
        // Pembayaran terlambat yang tetap diterima gateway (DECISIONS D6-12).
        'FAILED' => ['PAID'],
        'EXPIRED' => ['PAID'],
        'REFUNDED' => [],
    ];

    public function transition(Payment $payment, string $to): void
    {
        $from = $payment->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw new InvalidStateTransition("Payment status cannot transition from {$from} to {$to}.", [
                'from' => $from,
                'to' => $to,
            ]);
        }

        $payment->status = $to;
    }
}
