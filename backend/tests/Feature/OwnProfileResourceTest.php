<?php

use App\Models\MentorProfile;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use App\Models\University;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

const OWN_PROFILE_USER_KEYS = ['id', 'name', 'email', 'phone', 'role', 'status'];
const OWN_PROFILE_STUDENT_KEYS = [
    'id', 'university', 'university_name_custom', 'nim', 'major', 'semester', 'bio', 'is_available',
    'campus_email', 'campus_email_verified_at', 'verification_status', 'has_ktm', 'verification_rejection_reason',
    'verification_attempts', 'verification_attempts_remaining',
];
const OWN_PROFILE_FORBIDDEN = ['password', 'password_hash', 'remember_token', 'access_token', 'refresh_token', 'token_hash',
    'ktm_file_url', 'verified_by', 'user_id', 'rating_avg', 'completed_contracts_count', 'created_at', 'updated_at',
    'email_verified_at', 'phone_verified_at', 'last_login_at'];

/** Semua kunci di payload, termasuk yang bersarang. */
function ownProfileAllKeys(array $payload): array
{
    $keys = [];
    foreach ($payload as $key => $value) {
        $keys[] = $key;
        if (is_array($value)) {
            $keys = [...$keys, ...ownProfileAllKeys($value)];
        }
    }

    return $keys;
}

function expectNoForbiddenKeys(array $payload): void
{
    expect(array_values(array_intersect(OWN_PROFILE_FORBIDDEN, ownProfileAllKeys($payload))))->toBe([]);
}

function studentWithProfile(array $profile = []): array
{
    $university = University::query()->create(['name' => 'Kampus', 'email_domain' => 'kampus.ac.id']);
    $user = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION', 'remember_token' => 'secret-remember']);
    $student = StudentProfile::query()->create([
        'user_id' => $user->id, 'university_id' => $university->id, 'major' => 'DKV',
        'ktm_file_url' => 'verification/ktm/x/secret.pdf', ...$profile,
    ]);

    return [$user, $student, $university];
}

it('returns only whitelisted user and student profile fields from /me/profile', function () {
    [$user, $student, $university] = studentWithProfile();

    $data = $this->withToken($user->createToken('test')->plainTextToken)->getJson('/api/v1/me/profile')
        ->assertOk()
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonPath('data.profile.university.name', 'Kampus')
        ->assertJsonPath('data.profile.has_ktm', true)
        ->assertJsonPath('data.profile.verification_status', 'PENDING')
        ->json('data');

    expect(array_keys($data['user']))->toEqualCanonicalizing(OWN_PROFILE_USER_KEYS)
        ->and(array_keys($data['profile']))->toEqualCanonicalizing(OWN_PROFILE_STUDENT_KEYS)
        ->and(array_keys($data['profile']['university']))->toEqualCanonicalizing(['id', 'name']);
    expectNoForbiddenKeys($data);
});

it('returns whitelisted UMKM and mentor profiles and no profile for admins', function () {
    $umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
    UmkmProfile::query()->create(['user_id' => $umkm->id, 'business_name' => 'Kopi Senja', 'city' => 'Bandung']);
    $mentor = User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']);
    $mentorProfile = MentorProfile::query()->create(['user_id' => $mentor->id, 'title' => 'Designer', 'institution' => 'Studio']);
    $category = ServiceCategory::query()->create(['name' => 'Desain Menu', 'slug' => 'desain-menu']);
    $mentorProfile->expertises()->attach($category->id);
    $admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);

    $umkmData = $this->withToken($umkm->createToken('t')->plainTextToken)->getJson('/api/v1/me/profile')->assertOk()->json('data');
    expect(array_keys($umkmData['profile']))->toEqualCanonicalizing(['id', 'business_name', 'business_type', 'address', 'city', 'latitude', 'longitude', 'instagram_url']);
    expectNoForbiddenKeys($umkmData);

    Auth::forgetGuards();
    $mentorData = $this->withToken($mentor->createToken('t')->plainTextToken)->getJson('/api/v1/me/profile')->assertOk()->json('data');
    expect(array_keys($mentorData['profile']))->toEqualCanonicalizing(['id', 'title', 'institution', 'bio', 'is_available', 'verification_status', 'expertises'])
        ->and($mentorData['profile']['expertises'])->toBe([['id' => $category->id, 'name' => 'Desain Menu']]);
    expectNoForbiddenKeys($mentorData);

    Auth::forgetGuards();
    $this->withToken($admin->createToken('t')->plainTextToken)->getJson('/api/v1/me/profile')
        ->assertOk()->assertJsonPath('data.profile', null);
});

it('uses the same whitelisted user in login and the profile update response', function () {
    [$user] = studentWithProfile();
    $user->forceFill(['email' => 'nadia@example.test', 'password_hash' => 'correct horse battery'])->save();

    $login = $this->postJson('/api/v1/auth/login', ['identifier' => 'nadia@example.test', 'password' => 'correct horse battery'])
        ->assertOk()->json('data');
    expect(array_keys($login['user']))->toEqualCanonicalizing(OWN_PROFILE_USER_KEYS)
        ->and(array_keys($login))->toEqualCanonicalizing(['user', 'tokens']);

    $update = $this->withToken($login['tokens']['access_token'])->putJson('/api/v1/me/profile', ['major' => 'Informatika'])
        ->assertOk()->assertJsonPath('data.profile.major', 'Informatika')->json('data');
    expect(array_keys($update['user']))->toEqualCanonicalizing(OWN_PROFILE_USER_KEYS)
        ->and(array_keys($update['profile']))->toEqualCanonicalizing(OWN_PROFILE_STUDENT_KEYS);
    expectNoForbiddenKeys($update);

    // Refresh hanya mengembalikan token (tanpa data user).
    $refresh = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $login['tokens']['refresh_token']])->assertOk()->json('data');
    expect($refresh)->not->toHaveKey('user');
});

it('exposes the latest KTM rejection reason to the student', function () {
    Storage::fake('private');
    [$user, $student] = studentWithProfile(['ktm_file_url' => null]);
    $token = $user->createToken('t')->plainTextToken;
    $this->withToken($token)->postJson('/api/v1/students/me/verification', [
        'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 test'),
    ])->assertAccepted();

    $admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
    Auth::forgetGuards();
    $this->withToken($admin->createToken('t')->plainTextToken)
        ->postJson("/api/v1/admin/verifications/{$student->id}/reject", ['type' => 'STUDENT_KTM', 'reason' => 'Foto KTM buram'])
        ->assertOk();

    Auth::forgetGuards();
    $this->withToken($token)->getJson('/api/v1/me/profile')
        ->assertOk()
        ->assertJsonPath('data.profile.verification_status', 'REJECTED')
        ->assertJsonPath('data.profile.verification_rejection_reason', 'Foto KTM buram');
});
