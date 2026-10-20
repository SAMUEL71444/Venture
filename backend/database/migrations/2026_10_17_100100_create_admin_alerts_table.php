<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ERD bagian 4: ADMIN_ALERTS. Tabel alert_follow_ups dibuat di fase scheduler/admin.
        Schema::create('admin_alerts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type', 40);
            $table->string('severity', 10)->default('MEDIUM');
            $table->string('reference_type', 40);
            $table->uuid('reference_id');
            $table->string('status', 30)->default('OPEN');
            $table->foreignUuid('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('follow_up_deadline')->nullable();
            $table->text('resolution_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['reference_type', 'reference_id']);
            $table->index(['status', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_alerts');
    }
};
