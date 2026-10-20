<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Hasil audit skema (PROGRESS.md "Audit"):
 * - Data keuangan tidak boleh ikut terhapus / kehilangan akun saat user/project/kontrak dihapus:
 *   FK kontrak, milestone, escrow, wallet, ledger, settlement, payment -> RESTRICT.
 * - ledger_transactions.idempotency_key NOT NULL (UNIQUE di Postgres membolehkan banyak NULL).
 * - portfolio_items.contract_id FK ke contracts (ERD).
 * - platform_settings.description (ERD).
 */
return new class extends Migration
{
    private const RESTRICT = [
        'contracts' => ['project_id' => 'projects', 'umkm_id' => 'users', 'student_id' => 'users'],
        'milestones' => ['contract_id' => 'contracts'],
        'escrows' => ['contract_id' => 'contracts'],
        'wallets' => ['user_id' => 'users'],
        'ledger_entries' => ['transaction_id' => 'ledger_transactions', 'escrow_id' => 'escrows', 'wallet_id' => 'wallets'],
        'milestone_settlements' => ['milestone_id' => 'milestones'],
        'payments' => ['payer_id' => 'users'],
    ];

    /** Aturan sebelum migration ini, untuk rollback. */
    private const PREVIOUS = [
        'contracts' => ['project_id' => 'cascade', 'umkm_id' => 'cascade', 'student_id' => 'cascade'],
        'milestones' => ['contract_id' => 'cascade'],
        'escrows' => ['contract_id' => 'cascade'],
        'wallets' => ['user_id' => 'set null'],
        'ledger_entries' => ['transaction_id' => 'cascade', 'escrow_id' => 'set null', 'wallet_id' => 'set null'],
        'milestone_settlements' => ['milestone_id' => 'cascade'],
        'payments' => ['payer_id' => 'set null'],
    ];

    public function up(): void
    {
        foreach (self::RESTRICT as $tableName => $columns) {
            Schema::table($tableName, function (Blueprint $table) use ($columns) {
                foreach ($columns as $column => $references) {
                    $table->dropForeign([$column]);
                    $table->foreign($column)->references('id')->on($references)->restrictOnDelete();
                }
            });
        }

        Schema::table('ledger_transactions', function (Blueprint $table) {
            $table->string('idempotency_key')->nullable(false)->change();
        });

        Schema::table('portfolio_items', function (Blueprint $table) {
            $table->foreign('contract_id')->references('id')->on('contracts')->nullOnDelete();
        });

        Schema::table('platform_settings', function (Blueprint $table) {
            $table->text('description')->nullable()->after('value');
        });

        $this->recreatePartialIndexes();
    }

    /**
     * SQLite membangun ulang tabel saat FK diubah dan kehilangan klausa WHERE pada partial
     * unique index. Buat ulang secara eksplisit (aman juga di Postgres).
     */
    private function recreatePartialIndexes(): void
    {
        DB::statement('DROP INDEX IF EXISTS contracts_one_active_per_project');
        DB::statement("CREATE UNIQUE INDEX contracts_one_active_per_project ON contracts (project_id) WHERE status IN ('AWAITING_PAYMENT', 'FUNDED', 'IN_PROGRESS', 'CANCELLATION_REQUESTED')");
        DB::statement('DROP INDEX IF EXISTS wallets_system_type_unique');
        DB::statement('CREATE UNIQUE INDEX wallets_system_type_unique ON wallets (type) WHERE user_id IS NULL');
    }

    public function down(): void
    {
        Schema::table('platform_settings', function (Blueprint $table) {
            $table->dropColumn('description');
        });

        Schema::table('portfolio_items', function (Blueprint $table) {
            $table->dropForeign(['contract_id']);
        });

        Schema::table('ledger_transactions', function (Blueprint $table) {
            $table->string('idempotency_key')->nullable()->change();
        });

        foreach (self::PREVIOUS as $tableName => $columns) {
            Schema::table($tableName, function (Blueprint $table) use ($columns) {
                foreach ($columns as $column => $onDelete) {
                    $table->dropForeign([$column]);
                    $table->foreign($column)->references('id')->on(self::RESTRICT[$table->getTable()][$column])->onDelete($onDelete);
                }
            });
        }

        $this->recreatePartialIndexes();
    }
};
