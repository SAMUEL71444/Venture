<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('umkm_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('category_id')->nullable()->constrained('service_categories')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->bigInteger('budget_min');
            $table->bigInteger('budget_max');
            $table->date('deadline')->nullable();
            $table->string('city')->nullable();
            $table->string('status', 30)->default('DRAFT');
            $table->timestamp('published_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('project_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('file_url');
            $table->string('file_name');
            $table->timestamps();
        });

        Schema::create('applications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignUuid('student_id')->constrained('users')->cascadeOnDelete();
            $table->uuid('invitation_id')->nullable();
            $table->text('proposal');
            $table->bigInteger('offered_price');
            $table->unsignedInteger('estimated_days');
            $table->json('proposed_milestones')->nullable();
            $table->unsignedInteger('match_score')->default(0);
            $table->string('status', 30)->default('PENDING');
            $table->timestamps();
        });

        Schema::create('contracts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('contract_no')->nullable()->unique();
            $table->foreignUuid('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignUuid('application_id')->nullable()->unique()->constrained('applications')->nullOnDelete();
            $table->foreignUuid('umkm_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('student_id')->constrained('users')->cascadeOnDelete();
            $table->bigInteger('total_amount');
            $table->decimal('platform_fee_pct', 5, 2)->nullable();
            $table->decimal('mentor_share_pct', 5, 2)->nullable();
            $table->bigInteger('mentor_min_fee')->nullable();
            $table->string('status', 30)->default('AWAITING_PAYMENT');
            $table->timestamp('payment_due_at')->nullable();
            $table->timestamp('funded_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignUuid('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('milestones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('contract_id')->constrained('contracts')->cascadeOnDelete();
            $table->unsignedInteger('sequence');
            $table->string('title');
            $table->text('description')->nullable();
            $table->bigInteger('amount');
            $table->date('due_date')->nullable();
            $table->foreignUuid('mentor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 30)->default('LOCKED');
            $table->unsignedInteger('revision_count')->default(0);
            $table->unsignedInteger('mentor_return_count')->default(0);
            $table->unsignedInteger('max_revisions')->default(2);
            $table->unsignedInteger('max_mentor_returns')->default(3);
            $table->timestamp('client_review_started_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('approved_via')->nullable();
            $table->timestamps();
        });

        Schema::create('mentor_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('milestone_id')->constrained('milestones')->cascadeOnDelete();
            $table->foreignUuid('mentor_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 30)->default('ACTIVE');
            $table->unsignedInteger('review_count')->default(0);
            $table->boolean('fee_eligible')->default(false);
            $table->bigInteger('fee_amount')->nullable();
            $table->timestamp('fee_paid_at')->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('replaced_at')->nullable();
            $table->timestamps();
        });

        Schema::create('submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('milestone_id')->constrained('milestones')->cascadeOnDelete();
            $table->unsignedInteger('version_no')->default(1);
            $table->text('notes')->nullable();
            $table->string('status', 30)->default('PENDING_MENTOR');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('submission_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('submission_id')->constrained('submissions')->cascadeOnDelete();
            $table->string('file_url');
            $table->string('file_name');
            $table->string('mime_type')->nullable();
            $table->bigInteger('size_bytes')->nullable();
            $table->timestamps();
        });

        Schema::create('submission_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('submission_id')->constrained('submissions')->cascadeOnDelete();
            $table->foreignUuid('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->string('reviewer_role', 30);
            $table->string('decision', 30);
            $table->text('feedback')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_reviews');
        Schema::dropIfExists('submission_files');
        Schema::dropIfExists('submissions');
        Schema::dropIfExists('mentor_assignments');
        Schema::dropIfExists('milestones');
        Schema::dropIfExists('contracts');
        Schema::dropIfExists('applications');
        Schema::dropIfExists('project_attachments');
        Schema::dropIfExists('projects');
    }
};
