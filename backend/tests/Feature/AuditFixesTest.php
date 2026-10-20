<?php

use App\Models\LedgerTransaction;
use App\Models\MentorProfile;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\payment\Gateway\PaymentGateway;
use App\Modules\payout\Gateway\DisbursementGateway;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsContracts;
use Tests\TestCase;

/** Regresi untuk perbaikan hasil audit kode vs desain (PROGRESS.md bagian Audit). */
class AuditFixesTest extends TestCase
{
    use BuildsContracts, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpParties();
    }

    public function test_financial_history_blocks_user_deletion(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'IN_PROGRESS']]);
        $this->assertGreaterThan(0, LedgerTransaction::query()->count());

        $this->expectException(QueryException::class);
        User::query()->whereKey($this->umkm->id)->delete();
    }

    public function test_ledger_idempotency_key_is_required(): void
    {
        $this->expectException(QueryException::class);
        LedgerTransaction::query()->create(['type' => 'TEST', 'idempotency_key' => null]);
    }

    public function test_mock_drivers_are_refused_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $this->app->forgetInstance(PaymentGateway::class);
        $this->app->forgetInstance(DisbursementGateway::class);

        try {
            app(PaymentGateway::class);
            $this->fail('Mock payment gateway must not resolve in production.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('not allowed in production', $exception->getMessage());
        }

        $this->expectException(RuntimeException::class);
        app(DisbursementGateway::class);
    }

    public function test_suspended_student_profile_is_not_public(): void
    {
        $profile = $this->studentProfile();

        $this->actingWith($this->umkm)->getJson("/api/v1/students/{$profile->id}")->assertOk();

        $this->student->update(['status' => 'SUSPENDED']);
        $this->actingWith($this->umkm)->getJson("/api/v1/students/{$profile->id}")->assertStatus(404);
    }

    public function test_own_profile_hides_internal_ktm_path(): void
    {
        $profile = $this->studentProfile();
        $profile->update(['ktm_file_url' => 'verification/ktm/x/secret.pdf', 'verified_by' => $this->admin->id]);

        $this->actingWith($this->student)->getJson('/api/v1/me/profile')
            ->assertOk()
            ->assertJsonMissingPath('data.profile.ktm_file_url')
            ->assertJsonMissingPath('data.profile.verified_by')
            ->assertJsonPath('data.profile.has_ktm', true);
    }

    public function test_mentor_can_set_expertise_categories(): void
    {
        $category = ServiceCategory::query()->create(['name' => 'Desain Menu', 'slug' => 'desain-menu']);
        $inactive = ServiceCategory::query()->create(['name' => 'Lama', 'slug' => 'lama', 'is_active' => false]);

        $this->actingWith($this->mentor)->putJson('/api/v1/me/profile', ['expertise_category_ids' => [$inactive->id]])->assertStatus(422);
        $this->actingWith($this->mentor)->putJson('/api/v1/me/profile', ['expertise_category_ids' => [$category->id]])
            ->assertOk()->assertJsonPath('data.profile.expertises.0.id', $category->id);

        $this->assertSame([$category->id], MentorProfile::query()->where('user_id', $this->mentor->id)->firstOrFail()->expertises()->pluck('service_categories.id')->all());
    }

    public function test_registration_is_rate_limited_per_ip(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/register/mentor', [])->assertStatus(422);
        }

        $this->postJson('/api/v1/auth/register/mentor', [])->assertStatus(429);
    }

    public function test_verification_decision_rejects_non_uuid_ids_with_404(): void
    {
        $this->actingWith($this->admin)->postJson('/api/v1/admin/verifications/not-a-uuid/approve', ['type' => 'MENTOR'])->assertStatus(404);
    }

    private function studentProfile(): StudentProfile
    {
        $university = University::query()->create(['name' => 'Kampus', 'email_domain' => 'kampus.ac.id', 'city' => 'Bandung']);

        return StudentProfile::query()->create(['user_id' => $this->student->id, 'university_id' => $university->id, 'verification_status' => 'VERIFIED']);
    }
}
