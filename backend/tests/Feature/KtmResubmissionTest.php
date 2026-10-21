<?php

use App\Models\AuditLog;
use App\Models\StudentProfile;
use App\Models\User;
use App\Modules\auth\State\VerificationStateMachine;
use App\Shared\Exceptions\InvalidStateTransition;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('private');
    $this->studentUser = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION']);
    $this->profile = StudentProfile::query()->create(['user_id' => $this->studentUser->id, 'university_name_custom' => 'Kampus Uji']);
    $this->studentToken = $this->studentUser->createToken('s')->plainTextToken;
    $this->adminToken = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE'])->createToken('a')->plainTextToken;
});

function uploadKtmAs(string $token)
{
    Auth::forgetGuards();

    return test()->withToken($token)->postJson('/api/v1/students/me/verification', [
        'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 '.uniqid()),
    ]);
}

function rejectAs(string $token, string $profileId, string $reason)
{
    Auth::forgetGuards();

    return test()->withToken($token)->postJson("/api/v1/admin/verifications/{$profileId}/reject", ['type' => 'STUDENT_KTM', 'reason' => $reason]);
}

it('lets a rejected student upload a new KTM and go back to pending review', function () {
    uploadKtmAs($this->studentToken)->assertAccepted();
    $firstPath = $this->profile->fresh()->ktm_file_url;
    rejectAs($this->adminToken, $this->profile->id, 'Foto buram')->assertOk();

    uploadKtmAs($this->studentToken)->assertAccepted()->assertJsonPath('data.verification_status', 'PENDING');

    $profile = $this->profile->fresh();
    expect($profile->verification_status)->toBe('PENDING')
        ->and($profile->verification_attempts)->toBe(2)
        ->and($profile->ktm_file_url)->not->toBe($firstPath);
    Storage::disk('private')->assertMissing($firstPath);
    Storage::disk('private')->assertExists($profile->ktm_file_url);

    Auth::forgetGuards();
    $this->withToken($this->studentToken)->getJson('/api/v1/me/profile')
        ->assertJsonPath('data.profile.verification_attempts', 2)
        ->assertJsonPath('data.profile.verification_attempts_remaining', 1);
});

it('allows at most three submissions and keeps every rejection reason', function () {
    foreach (['Alasan 1', 'Alasan 2', 'Alasan 3'] as $reason) {
        uploadKtmAs($this->studentToken)->assertAccepted();
        rejectAs($this->adminToken, $this->profile->id, $reason)->assertOk();
    }

    uploadKtmAs($this->studentToken)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'VERIFICATION_ATTEMPTS_EXCEEDED')
        ->assertJsonPath('error.details.max_attempts', 3)
        ->assertJsonPath('error.details.attempts', 3);

    expect($this->profile->fresh()->verification_status)->toBe('REJECTED')
        ->and(AuditLog::query()->where('action', 'STUDENT_KTM_reject')->where('entity_id', $this->profile->id)->count())->toBe(3);

    Auth::forgetGuards();
    $this->withToken($this->studentToken)->getJson('/api/v1/me/profile')
        ->assertJsonPath('data.profile.verification_rejection_reason', 'Alasan 3')
        ->assertJsonPath('data.profile.verification_attempts_remaining', 0);
});

it('keeps replacing a file while pending from counting as a new submission', function () {
    uploadKtmAs($this->studentToken)->assertAccepted();
    uploadKtmAs($this->studentToken)->assertAccepted();

    expect($this->profile->fresh()->verification_attempts)->toBe(1);
});

it('still rejects other verification transitions', function (string $from, string $to) {
    $profile = new StudentProfile(['verification_status' => $from]);

    expect(fn () => app(VerificationStateMachine::class)->transition($profile, $to))->toThrow(InvalidStateTransition::class);
})->with([
    ['VERIFIED', 'PENDING'],
    ['VERIFIED', 'REJECTED'],
    ['REJECTED', 'VERIFIED'],
    ['PENDING', 'PENDING'],
]);

it('does not allow verified students to upload again', function () {
    $this->profile->forceFill(['verification_status' => 'VERIFIED'])->save();

    uploadKtmAs($this->studentToken)->assertUnprocessable()->assertJsonPath('error.code', 'KTM_VERIFICATION_NOT_ALLOWED');
});
