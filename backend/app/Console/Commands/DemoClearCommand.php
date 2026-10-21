<?php

namespace App\Console\Commands;

use App\Support\Demo\DemoAccounts;
use App\Support\Demo\DemoDataCleaner;
use Illuminate\Console\Command;

/**
 * php artisan demo:clear [--force]
 * Menghapus HANYA data milik akun @demo.digitalin.test (lihat DemoDataCleaner).
 */
class DemoClearCommand extends Command
{
    protected $signature = 'demo:clear {--force : Lewati konfirmasi}';

    protected $description = 'Delete all demo data (accounts under @demo.digitalin.test and everything they own)';

    public function handle(DemoDataCleaner $cleaner): int
    {
        $accounts = DemoAccounts::query()->count();
        if ($accounts === 0) {
            $this->info('Tidak ada data demo.');

            return self::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm("Hapus {$accounts} akun demo beserta seluruh datanya?")) {
            $this->line('Dibatalkan.');

            return self::FAILURE;
        }

        $counts = $cleaner->clear();
        $this->table(['Data', 'Terhapus'], collect($counts)->map(fn ($n, $table) => [$table, $n])->values()->all());
        $this->info('Data demo dihapus.');

        return self::SUCCESS;
    }
}
