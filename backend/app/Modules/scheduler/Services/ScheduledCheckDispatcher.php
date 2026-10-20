<?php

namespace App\Modules\scheduler\Services;

use App\Modules\scheduler\Jobs\ScheduledCheckJob;
use DateTimeInterface;

/** Menjadwalkan delayed job pengecekan setelah transaksi pemanggil commit. */
final class ScheduledCheckDispatcher
{
    /** @param  iterable<DateTimeInterface>  $times */
    public function at(string $check, string $entityId, iterable $times): void
    {
        foreach ($times as $time) {
            ScheduledCheckJob::dispatch($check, $entityId)->delay($time)->afterCommit();
        }
    }
}
