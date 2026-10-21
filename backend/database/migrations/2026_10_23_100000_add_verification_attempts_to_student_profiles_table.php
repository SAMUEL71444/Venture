<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Riwayat pengajuan verifikasi KTM:
 * - verification_attempts: jumlah pengajuan (unggah pertama + unggah ulang setelah ditolak).
 * - ktm_submitted_at: waktu pengajuan terakhir (ditampilkan di antrean admin).
 * Alasan penolakan tetap di audit_logs dan tidak pernah dihapus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->unsignedTinyInteger('verification_attempts')->default(0)->after('ktm_file_url');
            $table->timestamp('ktm_submitted_at')->nullable()->after('verification_attempts');
        });

        // Profil yang sudah pernah mengunggah KTM dihitung satu pengajuan.
        DB::table('student_profiles')->whereNotNull('ktm_file_url')->update([
            'verification_attempts' => 1,
            'ktm_submitted_at' => DB::raw('updated_at'),
        ]);
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn(['verification_attempts', 'ktm_submitted_at']);
        });
    }
};
