<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fase 5 — scheduler & notifikasi.
 * NOTIFICATIONS dan ALERT_FOLLOW_UPS mengikuti 03-erd.md bagian 4.
 * SCHEDULER_ACTION_LOGS adalah tabel teknis (tidak ada di ERD) untuk memastikan setiap
 * reminder/eskalasi hanya dijalankan sekali walau job & cron berjalan berulang (DECISIONS D5-2).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 60);
            $table->string('title');
            $table->text('body');
            $table->json('data')->nullable();
            // Dipisah koma: IN_APP, WHATSAPP, EMAIL.
            $table->string('channels', 60);
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('alert_follow_ups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('alert_id')->constrained('admin_alerts')->cascadeOnDelete();
            $table->foreignUuid('admin_id')->constrained('users')->restrictOnDelete();
            $table->string('channel', 20);
            $table->string('outcome', 40);
            $table->text('notes')->nullable();
            $table->timestamp('followed_up_at');
            $table->timestamps();
        });

        Schema::create('scheduler_action_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('action_key')->unique();
            $table->string('entity_type', 40);
            $table->uuid('entity_id');
            $table->timestamp('performed_at');

            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduler_action_logs');
        Schema::dropIfExists('alert_follow_ups');
        Schema::dropIfExists('notifications');
    }
};
