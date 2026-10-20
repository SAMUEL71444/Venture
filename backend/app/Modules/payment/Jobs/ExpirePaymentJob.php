<?php

namespace App\Modules\payment\Jobs;

use App\Modules\payment\Services\PaymentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/** Delayed job expire-payment (07 bagian 1). Cron payments:expire-overdue jadi jaring pengaman. */
final class ExpirePaymentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly string $paymentId) {}

    public function handle(PaymentService $payments): void
    {
        // PaymentService::expire mengecek ulang status & expires_at sebelum bertindak.
        $payments->expire($this->paymentId);
    }
}
