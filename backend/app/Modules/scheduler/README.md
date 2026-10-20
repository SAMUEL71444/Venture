Modul scheduler — reminder, timeout, dan eskalasi (docs/backend-design/07-scheduler-dan-notifikasi.md).

- `Services/SchedulerPlanner.php` — menjadwalkan delayed job saat event terjadi (jeda dari `platform_settings`).
- `Services/SchedulerChecks.php` — pengecekan idempotent yang dipanggil delayed job dan cron.
- `Jobs/ScheduledCheckJob.php` — delayed job; command `scheduler:sweep` (harian) sebagai jaring pengaman.

Jalankan worker `php artisan queue:work` dan `php artisan schedule:work` (dev) / cron `schedule:run` (server).
