<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class IdentitySchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_identity_and_profile_schema_matches_the_approved_phase(): void
    {
        expect(Schema::hasColumns('users', [
            'id', 'name', 'email', 'phone', 'password_hash', 'role', 'status', 'phone_verified_at', 'email_verified_at', 'last_login_at',
        ]))->toBeTrue()
            ->and(Schema::hasColumns('otp_codes', [
                'phone', 'code_hash', 'attempt_count', 'verification_token_hash', 'expires_at', 'used_at',
            ]))->toBeTrue()
            ->and(Schema::hasTable('refresh_tokens'))->toBeTrue()
            ->and(Schema::hasTable('umkm_profiles'))->toBeTrue()
            ->and(Schema::hasTable('universities'))->toBeTrue()
            ->and(Schema::hasTable('student_profiles'))->toBeTrue()
            ->and(Schema::hasColumn('student_profiles', 'campus_email_verified_at'))->toBeTrue()
            ->and(Schema::hasTable('mentor_profiles'))->toBeTrue()
            ->and(Schema::hasTable('student_skills'))->toBeTrue()
            ->and(Schema::hasTable('mentor_expertises'))->toBeTrue()
            ->and(Schema::hasTable('portfolio_items'))->toBeTrue()
            ->and(Schema::hasColumns('audit_logs', [
                'actor_id', 'action', 'entity_type', 'entity_id', 'before_data', 'after_data', 'ip_address', 'created_at',
            ]))->toBeTrue();
    }
}
