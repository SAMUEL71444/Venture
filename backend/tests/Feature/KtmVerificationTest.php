<?php

use App\Models\AuditLog;
use App\Models\MentorProfile;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class KtmVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_uploads_private_ktm_and_admin_approves_with_audit_log(): void
    {
        Storage::fake('private');
        $studentUser = User::factory()->create([
            'role' => 'STUDENT',
            'status' => 'PENDING_VERIFICATION',
            'email_verified_at' => null,
        ]);
        $university = University::query()->create([
            'name' => 'Kampus Example',
            'email_domain' => 'example.ac.id',
            'city' => 'Bandung',
            'is_partner' => true,
        ]);
        $student = StudentProfile::query()->create([
            'user_id' => $studentUser->id,
            'university_id' => $university->id,
        ]);
        $studentToken = $studentUser->createToken('test')->plainTextToken;

        $this->withToken($studentToken)
            ->postJson('/api/v1/students/me/verification', [
                'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 test document'),
            ])
            ->assertAccepted()
            ->assertJsonPath('data.verification_status', 'PENDING');

        $student->refresh();
        expect($student->ktm_file_url)->not->toBeEmpty()
            ->and($student->verification_status)->toBe('PENDING');
        expect(Storage::disk('private')->exists($student->ktm_file_url))->toBeTrue();

        $admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
        $adminToken = $admin->createToken('test')->plainTextToken;
        Auth::forgetGuards();

        $this->withToken($adminToken)
            ->get('/api/v1/admin/students/'.$student->id.'/ktm')
            ->assertOk();

        $this->withToken($adminToken)
            ->postJson('/api/v1/admin/verifications/'.$student->id.'/approve', ['type' => 'STUDENT_KTM'])
            ->assertOk()
            ->assertJsonPath('data.verification_status', 'VERIFIED');

        expect($student->fresh()->verification_status)->toBe('VERIFIED')
            ->and($studentUser->fresh()->status)->toBe('ACTIVE')
            ->and(AuditLog::query()->where('action', 'STUDENT_KTM_approve')->count())->toBe(1);
    }

    public function test_non_admin_cannot_access_verification_queue(): void
    {
        $student = User::factory()->create(['role' => 'STUDENT']);
        $token = $student->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/v1/admin/verifications')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_admin_approves_mentor_and_audit_log_records_decision(): void
    {
        $mentorUser = User::factory()->create([
            'role' => 'MENTOR',
            'status' => 'PENDING_VERIFICATION',
        ]);
        $mentor = MentorProfile::query()->create([
            'user_id' => $mentorUser->id,
            'title' => 'Senior Designer',
            'institution' => 'Studio Example',
        ]);
        $admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
        $token = $admin->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/v1/admin/verifications/'.$mentor->id.'/approve', ['type' => 'MENTOR'])
            ->assertOk()
            ->assertJsonPath('data.verification_status', 'VERIFIED');

        expect($mentor->fresh()->verification_status)->toBe('VERIFIED')
            ->and($mentorUser->fresh()->status)->toBe('ACTIVE')
            ->and(AuditLog::query()->where('action', 'MENTOR_approve')->count())->toBe(1);
    }
}
