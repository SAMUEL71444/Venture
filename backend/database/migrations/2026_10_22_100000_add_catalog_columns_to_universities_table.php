<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Katalog universitas (diimpor dari database/data/universities_id.json):
 * - short_name & province untuk pencarian/tampilan di form registrasi.
 * - email_domain boleh kosong (domain email kampus belum diketahui); unique tetap.
 * - name unique supaya impor bisa upsert berdasarkan nama tanpa duplikat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('universities', function (Blueprint $table) {
            $table->string('short_name', 30)->nullable()->after('name');
            $table->string('province', 60)->nullable()->after('city');
        });

        Schema::table('universities', function (Blueprint $table) {
            $table->string('email_domain')->nullable()->change();
            $table->unique('name');
        });
    }

    public function down(): void
    {
        if (DB::table('universities')->whereNull('email_domain')->exists()) {
            // Tidak menghapus data: universitas tanpa domain harus dilengkapi dulu.
            throw new RuntimeException('Cannot roll back: some universities have no email_domain.');
        }

        Schema::table('universities', function (Blueprint $table) {
            $table->dropUnique(['name']);
        });

        Schema::table('universities', function (Blueprint $table) {
            $table->string('email_domain')->nullable(false)->change();
            $table->dropColumn(['short_name', 'province']);
        });
    }
};
