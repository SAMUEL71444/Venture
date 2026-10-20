<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Modules\payment\Services\PaymentService;
use Illuminate\Console\Command;

/** Jaring pengaman untuk delayed job expire-payment (07 bagian 1). */
final class ExpireOverduePaymentsCommand extends Command
{
    protected $signature = 'payments:expire-overdue';

    protected $description = 'Expire PENDING payments past expires_at and cancel their contracts';

    public function handle(PaymentService $payments): int
    {
        $count = 0;

        Payment::query()
            ->where('status', 'PENDING')
            ->where('expires_at', '<=', now())
            ->orderBy('expires_at')
            ->pluck('id')
            ->each(function (string $paymentId) use ($payments, &$count) {
                $payments->expire($paymentId);
                $count++;
            });

        $this->info("Checked {$count} overdue payment(s).");

        return self::SUCCESS;
    }
}
