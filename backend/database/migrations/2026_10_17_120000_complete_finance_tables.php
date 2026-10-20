<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Melengkapi tabel keuangan Fase 3 sesuai 03-erd.md bagian 3 dan 06-alur-keuangan-escrow.md.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('milestone_settlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('milestone_id')->unique()->constrained('milestones')->cascadeOnDelete();
            $table->bigInteger('gross_amount');
            $table->bigInteger('platform_fee');
            $table->bigInteger('mentor_fee');
            // Boleh negatif: fee mentor yang ditanggung platform (06 bagian 4).
            $table->bigInteger('platform_net');
            $table->bigInteger('student_amount');
            $table->bigInteger('refund_amount')->default(0);
            $table->foreignUuid('ledger_transaction_id')->constrained('ledger_transactions')->restrictOnDelete();
            $table->timestamp('settled_at');
            $table->timestamps();
        });

        Schema::table('payments', function (Blueprint $table) {
            // URL / instruksi bayar dari gateway (Snap redirect, invoice URL, dll).
            $table->string('checkout_url', 2048)->nullable()->after('method');
            $table->index(['reference_type', 'reference_id', 'status']);
        });

        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->index('wallet_id');
            $table->index('escrow_id');
        });

        // Satu wallet per (user, type); satu wallet sistem per type (user_id NULL).
        Schema::table('wallets', function (Blueprint $table) {
            $table->unique(['user_id', 'type']);
        });
        DB::statement('CREATE UNIQUE INDEX wallets_system_type_unique ON wallets (type) WHERE user_id IS NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS wallets_system_type_unique');

        Schema::table('wallets', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'type']);
        });

        Schema::table('ledger_entries', function (Blueprint $table) {
            $table->dropIndex(['wallet_id']);
            $table->dropIndex(['escrow_id']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['reference_type', 'reference_id', 'status']);
            $table->dropColumn('checkout_url');
        });

        Schema::dropIfExists('milestone_settlements');
    }
};
