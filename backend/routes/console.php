<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Jaring pengaman untuk delayed job (07-scheduler-dan-notifikasi.md). Jalankan `php artisan schedule:work`
// (dev) atau cron `* * * * * php artisan schedule:run` (server), plus `php artisan queue:work` untuk delayed job.
Schedule::command('payments:expire-overdue')->hourly()->withoutOverlapping();
Schedule::command('scheduler:sweep')->dailyAt('01:00')->timezone(config('app.business_timezone'))->withoutOverlapping();
