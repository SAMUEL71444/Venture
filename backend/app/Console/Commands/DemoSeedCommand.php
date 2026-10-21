<?php

namespace App\Console\Commands;

use App\Models\University;
use App\Modules\payment\Gateway\MockPaymentGateway;
use App\Modules\payment\Gateway\PaymentGateway;
use App\Support\Demo\DemoAccounts;
use App\Support\Demo\DemoDataCleaner;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * php artisan demo:seed [--allow-production]
 * Membuat data demo (akun @demo.digitalin.test). Menolak berjalan bila data demo sudah
 * ada (hapus dulu dengan demo:clear) dan di production kecuali --allow-production.
 * Password akun demo dibuat acak dan dicetak SEKALI ke terminal — tidak disimpan di mana pun.
 */
class DemoSeedCommand extends Command
{
    protected $signature = 'demo:seed {--allow-production : Izinkan berjalan saat APP_ENV=production}';

    protected $description = 'Seed realistic demo data (accounts under @demo.digitalin.test)';

    public function handle(DemoDataCleaner $cleaner): int
    {
        if (app()->isProduction() && ! $this->option('allow-production')) {
            $this->error('APP_ENV=production: demo:seed ditolak. Tambahkan --allow-production jika memang disengaja.');

            return self::FAILURE;
        }

        if (DemoAccounts::exist()) {
            $this->error('Data demo sudah ada. Jalankan php artisan demo:clear terlebih dahulu.');

            return self::FAILURE;
        }

        if (! University::query()->exists()) {
            $this->error('Katalog universitas kosong. Jalankan php artisan universities:import terlebih dahulu.');

            return self::FAILURE;
        }

        try {
            $gateway = app(PaymentGateway::class);
        } catch (Throwable) {
            $gateway = null;
        }
        if (! $gateway instanceof MockPaymentGateway) {
            $this->error('Data demo membutuhkan driver pembayaran mock (PAYMENT_GATEWAY_DRIVER=mock, di luar production).');

            return self::FAILURE;
        }

        $password = Str::password(16, symbols: false);
        $this->info('Membuat data demo… (bisa memakan waktu sekitar satu menit)');

        try {
            DB::transaction(fn () => (new DemoDataSeeder)->withPassword($password)->run());
        } catch (Throwable $exception) {
            // Transaksi sudah di-rollback; file yang sempat tersimpan ikut dibersihkan.
            $cleaner->clear();
            $this->error('Gagal membuat data demo: '.$exception->getMessage());

            return self::FAILURE;
        }

        $this->newLine();
        $this->table(['Data', 'Jumlah'], $this->summary());
        $this->newLine();
        $this->warn('Password SEMUA akun demo (dicetak sekali, tidak disimpan di mana pun):');
        $this->line("  {$password}");
        $this->line('Contoh akun: rizky.pratama@'.DemoAccounts::DOMAIN.' (admin), kopi.anteng@'.DemoAccounts::DOMAIN.' (UMKM), nadia.putri@'.DemoAccounts::DOMAIN.' (mahasiswa).');

        return self::SUCCESS;
    }

    /** @return list<array{0: string, 1: int}> */
    private function summary(): array
    {
        $users = DemoAccounts::query()->pluck('id');
        $count = fn (string $table, string $column, $ids) => DB::table($table)->whereIn($column, $ids)->count();
        $contracts = DB::table('contracts')->whereIn('umkm_id', $users)->pluck('id');

        return [
            ['Akun UMKM', DemoAccounts::query()->where('role', 'UMKM')->count()],
            ['Akun mahasiswa', DemoAccounts::query()->where('role', 'STUDENT')->count()],
            ['Akun mentor', DemoAccounts::query()->where('role', 'MENTOR')->count()],
            ['Akun admin', DemoAccounts::query()->where('role', 'ADMIN')->count()],
            ['Proyek', $count('projects', 'umkm_id', $users)],
            ['Lamaran', DB::table('applications')->whereIn('student_id', $users)->count()],
            ['Kontrak', $contracts->count()],
            ['Milestone', $count('milestones', 'contract_id', $contracts)],
            ['Escrow', $count('escrows', 'contract_id', $contracts)],
            ['Sengketa (REVISION_LIMIT_DISPUTE)', DB::table('admin_alerts')->where('type', 'REVISION_LIMIT_DISPUTE')
                ->whereIn('reference_id', DB::table('milestones')->whereIn('contract_id', $contracts)->pluck('id'))->count()],
            ['Alert admin', DB::table('admin_alerts')->whereIn('reference_id', DB::table('milestones')->whereIn('contract_id', $contracts)->pluck('id')
                ->merge($contracts)->merge(DB::table('cancellation_requests')->whereIn('contract_id', $contracts)->pluck('id')))->count()],
            ['Pesan', DB::table('messages')->whereIn('sender_id', $users)->count()],
            ['Notifikasi', $count('notifications', 'user_id', $users)],
        ];
    }
}
