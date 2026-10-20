<?php

use App\Models\OtpCode;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\auth\Notifications\VerifyCampusEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.meta_whatsapp.api_base_url' => 'https://graph.facebook.com',
            'services.meta_whatsapp.api_version' => 'v22.0',
            'services.meta_whatsapp.phone_number_id' => 'test-phone-number-id',
            'services.meta_whatsapp.access_token' => 'test-access-token',
            'services.meta_whatsapp.otp_template' => 'otp_verification',
            'services.meta_whatsapp.language' => 'id',
        ]);
        Http::fake();
    }

    public function test_umkm_registers_after_otp_verification_and_receives_tokens(): void
    {
        $this->postJson('/api/v1/auth/otp/send', ['phone' => '+6281234567890'])->assertAccepted();
        $code = null;

        Http::assertSent(function (Request $request) use (&$code) {
            $code = $request->data()['template']['components'][0]['parameters'][0]['text'];

            return $request['messaging_product'] === 'whatsapp';
        });

        $verification = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '+6281234567890',
            'code' => $code,
        ])->assertOk()->json('data.verification_token');

        $response = $this->postJson('/api/v1/auth/register/umkm', [
            'business_name' => 'Kopi Senja',
            'phone' => '+6281234567890',
            'verification_token' => $verification,
            'password' => 'correct horse battery',
        ])->assertCreated()
            ->assertJsonPath('data.user.role', 'UMKM')
            ->assertJsonPath('data.user.status', 'ACTIVE')
            ->assertJsonPath('data.profile.business_name', 'Kopi Senja')
            ->assertJsonPath('data.tokens.token_type', 'Bearer');

        $user = User::query()->firstOrFail();
        expect($user->phone_verified_at)->not->toBeNull()
            ->and($user->password_hash)->not->toBe('correct horse battery')
            ->and($response->json('data.tokens.access_token'))->not->toBeEmpty()
            ->and(OtpCode::query()->firstOrFail()->verification_token_hash)->toBeNull();

        $this->postJson('/api/v1/auth/register/umkm', [
            'business_name' => 'Second Store',
            'phone' => '+6281234567890',
            'verification_token' => $verification,
            'password' => 'correct horse battery',
        ])->assertUnprocessable();
    }

    public function test_campus_email_signed_link_activates_student_once(): void
    {
        Notification::fake();
        $university = University::query()->create([
            'name' => 'Kampus Example',
            'email_domain' => 'example.ac.id',
            'city' => 'Bandung',
            'is_partner' => true,
        ]);

        $response = $this->postJson('/api/v1/auth/register/student', [
            'name' => 'Nadia Putri',
            'email' => 'nadia@example.test',
            'password' => 'correct horse battery',
            'university_id' => $university->id,
            'campus_email' => 'nadia@example.ac.id',
        ])->assertCreated()
            ->assertJsonPath('data.user.status', 'PENDING_VERIFICATION');

        $student = StudentProfile::query()->firstOrFail();
        $user = User::query()->findOrFail($response->json('data.user.id'));
        Notification::assertSentOnDemand(VerifyCampusEmailNotification::class);

        $signedUrl = URL::temporarySignedRoute(
            'auth.email.verify',
            now()->addMinutes(60),
            ['profile' => $student->id, 'hash' => sha1($student->campus_email)],
        );

        $this->getJson($signedUrl)
            ->assertOk()
            ->assertJsonPath('data.verified', true);

        expect($student->fresh()->verification_status)->toBe('VERIFIED')
            ->and($student->fresh()->campus_email_verified_at)->not->toBeNull()
            ->and($user->fresh()->status)->toBe('ACTIVE');

        $this->getJson($signedUrl)->assertStatus(409);
    }

    public function test_pending_student_can_upload_ktm_but_cannot_use_active_role_features(): void
    {
        $university = University::query()->create([
            'name' => 'Kampus Example',
            'email_domain' => 'example.ac.id',
        ]);
        $user = User::factory()->create([
            'role' => 'STUDENT',
            'status' => 'PENDING_VERIFICATION',
        ]);
        StudentProfile::query()->create([
            'user_id' => $user->id,
            'university_id' => $university->id,
        ]);
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/students/me/portfolio', ['title' => 'Not allowed yet'])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'ACCOUNT_PENDING_VERIFICATION');

        $this->postJson('/api/v1/students/me/verification', [
            'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 pending student'),
        ])->assertAccepted();
    }

    public function test_login_refresh_rotation_and_logout_revoke_tokens(): void
    {
        $user = User::factory()->create([
            'email' => 'student@example.test',
            'phone' => '+6281234567890',
            'password_hash' => 'correct horse battery',
            'role' => 'STUDENT',
            'status' => 'ACTIVE',
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'identifier' => 'STUDENT@example.test',
            'password' => 'correct horse battery',
        ])->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.tokens.token_type', 'Bearer');

        $oldRefresh = $login->json('data.tokens.refresh_token');
        $rotated = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $oldRefresh])
            ->assertOk();

        expect($rotated->json('data.refresh_token'))->not->toBe($oldRefresh);

        $this->withToken($rotated->json('data.access_token'))
            ->postJson('/api/v1/auth/logout', ['refresh_token' => $rotated->json('data.refresh_token')])
            ->assertOk()
            ->assertJsonPath('data.logged_out', true);

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $rotated->json('data.refresh_token')])
            ->assertUnauthorized();
    }

    public function test_reusing_a_rotated_refresh_token_revokes_all_sessions(): void
    {
        $user = User::factory()->create([
            'email' => 'mentor@example.test', 'password_hash' => 'correct horse battery', 'role' => 'MENTOR', 'status' => 'ACTIVE',
        ]);
        $tokens = $this->postJson('/api/v1/auth/login', ['identifier' => 'mentor@example.test', 'password' => 'correct horse battery'])
            ->assertOk()->json('data.tokens');
        $rotated = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $tokens['refresh_token']])->assertOk()->json('data');

        // Token lama yang sudah dirotasi dipakai lagi (indikasi dicuri) -> semua sesi dicabut (audit F7).
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $tokens['refresh_token']])
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');

        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $rotated['refresh_token']])->assertUnauthorized();
        $this->assertSame(0, $user->tokens()->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'REFRESH_TOKEN_REUSE_DETECTED', 'entity_id' => $user->id]);
    }

    public function test_student_email_uniqueness_is_case_insensitive(): void
    {
        $university = University::query()->create([
            'name' => 'Kampus Example',
            'email_domain' => 'example.ac.id',
        ]);
        User::factory()->create(['email' => 'student@example.test']);

        $this->postJson('/api/v1/auth/register/student', [
            'name' => 'Another Student',
            'email' => 'STUDENT@EXAMPLE.TEST',
            'password' => 'correct horse battery',
            'university_id' => $university->id,
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_user_can_login_with_phone_number(): void
    {
        User::factory()->create([
            'email' => null,
            'phone' => '+6281234567890',
            'password_hash' => 'correct horse battery',
            'role' => 'UMKM',
            'status' => 'ACTIVE',
        ]);

        $this->postJson('/api/v1/auth/login', [
            'identifier' => '+6281234567890',
            'password' => 'correct horse battery',
        ])->assertOk()
            ->assertJsonPath('data.user.role', 'UMKM');
    }
}
