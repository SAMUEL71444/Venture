<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Melengkapi tabel Fase 2 sesuai 03-erd.md bagian 2:
 * PROJECT_TEMPLATES, PROJECTS.template_id, INVITATIONS, dan partial unique index
 * "satu kontrak aktif per project".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('category_id')->constrained('service_categories')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            // [{ "title": "...", "percentage": 40 }, ...], total 100
            $table->json('default_milestones');
            $table->bigInteger('suggested_budget_min')->nullable();
            $table->bigInteger('suggested_budget_max')->nullable();
            $table->unsignedInteger('suggested_duration_days')->nullable();
            $table->timestamps();
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->foreignUuid('template_id')->nullable()->after('category_id')
                ->constrained('project_templates')->nullOnDelete();
        });

        Schema::create('invitations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignUuid('student_id')->constrained('users')->cascadeOnDelete();
            $table->text('message')->nullable();
            $table->string('status', 20)->default('PENDING');
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['project_id', 'student_id', 'status']);
        });

        Schema::table('applications', function (Blueprint $table) {
            $table->foreign('invitation_id')->references('id')->on('invitations')->nullOnDelete();
            $table->index(['project_id', 'student_id', 'status']);
        });

        // Postgres & SQLite mendukung partial index dengan sintaks yang sama.
        DB::statement("CREATE UNIQUE INDEX contracts_one_active_per_project ON contracts (project_id) WHERE status IN ('AWAITING_PAYMENT', 'FUNDED', 'IN_PROGRESS', 'CANCELLATION_REQUESTED')");
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS contracts_one_active_per_project');

        Schema::table('applications', function (Blueprint $table) {
            $table->dropForeign(['invitation_id']);
            $table->dropIndex(['project_id', 'student_id', 'status']);
        });

        Schema::dropIfExists('invitations');

        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('template_id');
        });

        Schema::dropIfExists('project_templates');
    }
};
