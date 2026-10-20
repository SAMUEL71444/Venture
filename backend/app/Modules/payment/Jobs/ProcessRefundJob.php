<?php

namespace App\Modules\payment\Jobs;

use App\Modules\payment\Services\RefundService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class ProcessRefundJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(
        public readonly string $refundId,
        public readonly bool $fromPayable,
    ) {}

    public function handle(RefundService $refunds): void
    {
        $refunds->process($this->refundId, $this->fromPayable);
    }
}
