<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('payer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('purpose', 50)->default('ESCROW_FUNDING');
            $table->uuid('reference_id')->nullable();
            $table->string('reference_type', 50)->nullable();
            $table->bigInteger('amount');
            $table->bigInteger('gateway_fee')->default(0);
            $table->string('gateway', 30)->default('MIDTRANS');
            $table->string('gateway_ref')->unique()->nullable();
            $table->string('method', 30)->nullable();
            $table->string('status', 30)->default('PENDING');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });

        Schema::create('payment_webhook_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('gateway', 30);
            $table->string('gateway_ref');
            $table->string('event_type', 50);
            $table->json('payload');
            $table->boolean('processed')->default(false);
            $table->timestamp('received_at')->useCurrent();
            $table->timestamps();
            $table->index(['gateway', 'gateway_ref']);
        });

        Schema::create('escrows', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('contract_id')->unique()->constrained('contracts')->cascadeOnDelete();
            $table->foreignUuid('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->bigInteger('funded_amount')->default(0);
            $table->bigInteger('released_amount')->default(0);
            $table->bigInteger('refunded_amount')->default(0);
            $table->bigInteger('held_amount')->default(0);
            $table->string('status', 30)->default('PENDING_FUNDING');
            $table->timestamps();
        });

        Schema::create('wallets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 30)->default('STUDENT');
            $table->bigInteger('balance')->default(0);
            $table->bigInteger('pending_withdrawal')->default(0);
            $table->timestamps();
        });

        Schema::create('ledger_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type', 50);
            $table->string('reference_type', 50)->nullable();
            $table->uuid('reference_id')->nullable();
            $table->string('idempotency_key')->unique()->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('transaction_id')->constrained('ledger_transactions')->cascadeOnDelete();
            $table->string('account_type', 30);
            $table->foreignUuid('escrow_id')->nullable()->constrained('escrows')->nullOnDelete();
            $table->foreignUuid('wallet_id')->nullable()->constrained('wallets')->nullOnDelete();
            $table->string('direction', 10);
            $table->bigInteger('amount');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
        Schema::dropIfExists('ledger_transactions');
        Schema::dropIfExists('wallets');
        Schema::dropIfExists('escrows');
        Schema::dropIfExists('payment_webhook_logs');
        Schema::dropIfExists('payments');
    }
};
