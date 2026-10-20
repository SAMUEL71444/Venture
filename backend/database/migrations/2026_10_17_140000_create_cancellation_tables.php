<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase 6 — pembatalan & refund (03-erd.md bagian 3 & 4).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cancellation_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->foreignUuid('requested_by')->constrained('users')->restrictOnDelete();
            // UMKM, STUDENT; ADMIN untuk terminasi langsung oleh admin (DECISIONS D6-9).
            $table->string('requester_role', 20);
            $table->string('type', 20); // DIRECT, NEEDS_REVIEW
            $table->text('reason');
            $table->json('evidence_urls')->nullable();
            $table->text('counterparty_response')->nullable();
            $table->string('status', 20)->default('PENDING');
            $table->foreignUuid('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('admin_notes')->nullable();
            $table->timestamp('response_due_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['contract_id', 'status']);
        });

        // Satu pengajuan PENDING per kontrak.
        DB::statement("CREATE UNIQUE INDEX cancellation_requests_one_pending ON cancellation_requests (contract_id) WHERE status = 'PENDING'");

        Schema::create('cancellation_allocations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('cancellation_request_id')->constrained('cancellation_requests')->cascadeOnDelete();
            $table->foreignUuid('milestone_id')->constrained('milestones')->restrictOnDelete();
            $table->bigInteger('amount_to_student');
            $table->bigInteger('amount_to_umkm');
            $table->bigInteger('mentor_fee')->default(0);
            $table->timestamps();

            $table->unique(['cancellation_request_id', 'milestone_id']);
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('payment_id')->constrained('payments')->restrictOnDelete();
            $table->foreignUuid('cancellation_request_id')->nullable()->constrained('cancellation_requests')->nullOnDelete();
            $table->bigInteger('amount');
            $table->string('status', 20)->default('PENDING');
            $table->string('gateway_ref')->nullable()->unique();
            $table->timestamps();
        });

        Schema::table('milestones', function (Blueprint $table) {
            // Teknis: total jeda timer review UMKM selama CANCELLATION_REQUESTED (DECISIONS D6-6).
            $table->unsignedInteger('client_review_paused_seconds')->default(0)->after('client_review_started_at');
        });
    }

    public function down(): void
    {
        Schema::table('milestones', function (Blueprint $table) {
            $table->dropColumn('client_review_paused_seconds');
        });
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('cancellation_allocations');
        DB::statement('DROP INDEX IF EXISTS cancellation_requests_one_pending');
        Schema::dropIfExists('cancellation_requests');
    }
};
