<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otp_codes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('phone', 20)->index();
            $table->string('code_hash');
            $table->string('purpose', 30);
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->string('verification_token_hash')->nullable()->unique();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('verification_expires_at')->nullable();
            $table->timestamp('expires_at')->index();
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
            $table->index(['phone', 'purpose', 'created_at']);
        });

        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->timestamp('expires_at')->index();
            $table->timestamp('revoked_at')->nullable();
            $table->uuid('replaced_by_id')->nullable();
            $table->timestamps();
        });

        Schema::table('refresh_tokens', function (Blueprint $table) {
            $table->foreign('replaced_by_id')->references('id')->on('refresh_tokens')->nullOnDelete();
        });

        Schema::create('umkm_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('business_name');
            $table->string('business_type')->nullable();
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('instagram_url')->nullable();
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('universities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email_domain')->unique();
            $table->string('city')->nullable();
            $table->boolean('is_partner')->default(false);
            $table->timestamps();
        });

        Schema::create('student_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignUuid('university_id')->constrained()->restrictOnDelete();
            $table->string('nim')->nullable();
            $table->string('major')->nullable();
            $table->unsignedTinyInteger('semester')->nullable();
            $table->string('campus_email')->nullable()->unique();
            $table->timestamp('campus_email_verified_at')->nullable();
            $table->string('ktm_file_url')->nullable();
            $table->string('verification_status', 20)->default('PENDING');
            $table->foreignUuid('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('bio')->nullable();
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('completed_contracts_count')->default(0);
            $table->unsignedInteger('active_contracts_count')->default(0);
            $table->boolean('is_available')->default(true);
            $table->timestamps();
        });

        Schema::create('mentor_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->string('institution');
            $table->text('bio')->nullable();
            $table->string('verification_status', 20)->default('PENDING');
            $table->unsignedInteger('max_active_reviews')->default(5);
            $table->boolean('is_available')->default(true);
            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('service_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('student_skills', function (Blueprint $table) {
            $table->foreignUuid('student_id')->constrained('student_profiles')->cascadeOnDelete();
            $table->foreignUuid('category_id')->constrained('service_categories')->cascadeOnDelete();
            $table->string('level', 20);
            $table->primary(['student_id', 'category_id']);
        });

        Schema::create('mentor_expertises', function (Blueprint $table) {
            $table->foreignUuid('mentor_id')->constrained('mentor_profiles')->cascadeOnDelete();
            $table->foreignUuid('category_id')->constrained('service_categories')->cascadeOnDelete();
            $table->primary(['mentor_id', 'category_id']);
        });

        Schema::create('portfolio_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('student_id')->constrained('student_profiles')->cascadeOnDelete();
            $table->uuid('contract_id')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('media_urls')->nullable();
            $table->boolean('is_verified')->default(false);
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('entity_type');
            $table->uuid('entity_id');
            $table->jsonb('before_data')->nullable();
            $table->jsonb('after_data')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('portfolio_items');
        Schema::dropIfExists('mentor_expertises');
        Schema::dropIfExists('student_skills');
        Schema::dropIfExists('service_categories');
        Schema::dropIfExists('mentor_profiles');
        Schema::dropIfExists('student_profiles');
        Schema::dropIfExists('universities');
        Schema::dropIfExists('umkm_profiles');
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('otp_codes');
    }
};
