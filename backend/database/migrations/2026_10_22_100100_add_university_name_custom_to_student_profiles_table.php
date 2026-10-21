<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Universitas yang tidak ada di daftar: mahasiswa mengetik namanya sendiri
 * (university_name_custom) dan university_id dibiarkan kosong. Tepat salah satu
 * dari keduanya terisi — dijaga validasi registrasi. Teks custom TIDAK membuat
 * baris baru di tabel universities.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('university_name_custom', 150)->nullable()->after('university_id');
        });

        Schema::table('student_profiles', function (Blueprint $table) {
            $table->foreignUuid('university_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (DB::table('student_profiles')->whereNull('university_id')->exists()) {
            // Tidak menghapus data: profil dengan universitas custom harus dipindahkan dulu.
            throw new RuntimeException('Cannot roll back: some student profiles use a custom university.');
        }

        Schema::table('student_profiles', function (Blueprint $table) {
            $table->foreignUuid('university_id')->nullable(false)->change();
            $table->dropColumn('university_name_custom');
        });
    }
};
