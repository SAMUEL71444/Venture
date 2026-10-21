<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * OTP multi-kanal: kode bisa dikirim ke email atau WhatsApp, untuk registrasi
 * maupun reset password. `identifier` = alamat email (huruf kecil) atau nomor E.164.
 * Kolom `phone` tetap ada (diisi untuk kanal WhatsApp) tetapi kini boleh null.
 * `purpose` sudah ada sejak awal (REGISTER); nilai baru: PASSWORD_RESET.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('otp_codes', function (Blueprint $table) {
            $table->string('channel', 20)->default('whatsapp')->after('id');
            $table->string('identifier')->nullable()->after('channel');
        });

        // Baris lama seluruhnya OTP WhatsApp.
        DB::table('otp_codes')->whereNull('identifier')->update(['identifier' => DB::raw('phone')]);

        Schema::table('otp_codes', function (Blueprint $table) {
            $table->string('phone', 20)->nullable()->change();
            $table->string('identifier')->nullable(false)->change();
            $table->index(['channel', 'identifier', 'purpose', 'created_at'], 'otp_codes_channel_identifier_purpose_index');
        });
    }

    public function down(): void
    {
        // Kode OTP email tidak punya nomor HP, sehingga tidak bisa dikembalikan ke skema lama.
        DB::table('otp_codes')->whereNull('phone')->delete();

        Schema::table('otp_codes', function (Blueprint $table) {
            $table->dropIndex('otp_codes_channel_identifier_purpose_index');
        });

        Schema::table('otp_codes', function (Blueprint $table) {
            $table->string('phone', 20)->nullable(false)->change();
            $table->dropColumn(['channel', 'identifier']);
        });
    }
};
