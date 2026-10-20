<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fase 7 — payout, sertifikat, rating, chat, premium listing (03-erd.md bagian 2–4).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bank_accounts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('channel', 10); // BANK, EWALLET
            $table->string('provider_code', 20);
            // Dienkripsi di level aplikasi (cast encrypted), hanya 4 digit terakhir yang ditampilkan.
            $table->text('account_number');
            $table->string('account_number_last4', 4);
            $table->string('account_holder_name');
            $table->boolean('is_verified')->default(false);
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
        });

        Schema::create('payouts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('wallet_id')->constrained('wallets')->restrictOnDelete();
            $table->foreignUuid('bank_account_id')->constrained('bank_accounts')->restrictOnDelete();
            $table->bigInteger('amount');
            $table->bigInteger('fee');
            $table->bigInteger('net_amount');
            $table->string('status', 20)->default('REQUESTED');
            $table->string('gateway_ref')->nullable()->unique();
            $table->timestamp('requested_at');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['wallet_id', 'status']);
        });

        Schema::create('certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('contract_id')->unique()->constrained('contracts')->restrictOnDelete();
            $table->foreignUuid('student_id')->constrained('users')->restrictOnDelete();
            $table->string('certificate_no')->unique();
            $table->string('verification_code', 64)->unique();
            $table->string('pdf_url')->nullable();
            $table->timestamp('issued_at');
            $table->timestamps();
        });

        Schema::create('ratings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignUuid('rater_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('ratee_id')->constrained('users')->cascadeOnDelete();
            $table->string('direction', 30); // UMKM_TO_STUDENT, STUDENT_TO_UMKM, STUDENT_TO_MENTOR
            $table->unsignedTinyInteger('score');
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->unique(['contract_id', 'rater_id', 'ratee_id']);
            $table->index(['ratee_id', 'direction']);
        });

        Schema::create('conversations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignUuid('contract_id')->nullable()->constrained('contracts')->nullOnDelete();
            $table->foreignUuid('umkm_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('student_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['project_id', 'student_user_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignUuid('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->string('attachment_url', 2048)->nullable();
            $table->boolean('is_flagged')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
        });

        Schema::create('premium_listings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignUuid('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->bigInteger('price');
            $table->unsignedInteger('duration_days');
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->string('status', 20)->default('PENDING_PAYMENT');
            $table->timestamps();

            $table->index(['project_id', 'status', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('premium_listings');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('ratings');
        Schema::dropIfExists('certificates');
        Schema::dropIfExists('payouts');
        Schema::dropIfExists('bank_accounts');
    }
};
