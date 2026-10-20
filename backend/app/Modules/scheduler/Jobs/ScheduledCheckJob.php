<?php

namespace App\Modules\scheduler\Jobs;

use App\Modules\scheduler\Services\SchedulerChecks;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Delayed job yang dijadwalkan saat event terjadi. Tidak membawa keputusan apa pun:
 * SchedulerChecks mengecek ulang status & waktu, jadi job yang "basi" otomatis tidak berbuat apa-apa
 * (inilah cara reminder "dibatalkan" saat UMKM merespons).
 */
final class ScheduledCheckJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public readonly string $check,
        public readonly string $entityId,
    ) {}

    public function handle(SchedulerChecks $checks): void
    {
        $checks->run($this->check, $this->entityId);
    }
}
