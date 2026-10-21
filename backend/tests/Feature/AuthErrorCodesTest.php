<?php

use App\Models\OtpCode;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\auth\Mail\OtpCodeMail;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    config([
        'services.meta_whatsapp.api_base_url' => 'https://graph.facebook.com',
        'services.meta_whatsapp.api_version' => 'v22.0',
        'services.meta_whatsapp.phone_number_id' => 'test-phone-number-id',
        'services.meta_whatsapp.access_token' => 'test-access-token',
        'services.meta_whatsapp.otp_template' => 'otp_verification',
        'services.meta_whatsapp.language' => 'id',
    ]);
    Http::fake();
    Mail::fake();
});

function sendRegisterOtp(string $email, string $ip = '127.0.0.1')
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip])
        ->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => $email]);
}

function verifyRegisterOtp(string $email, string $code)
{
    return test()->postJson('/api/v1/auth/otp/verify', ['channel' => 'email', 'identifier' => $email, 'code' => $code]);
}

function mailedOtp(): string
{
    $code = null;
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$code) {
        $code = $mail->code;

        return true;
    });

    return $code;
}

it('returns IDENTIFIER_ALREADY_REGISTERED for a registered contact', function () {
    User::factory()->create(['email' => 'taken@example.test']);

    sendRegisterOtp('taken@example.test')
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'IDENTIFIER_ALREADY_REGISTERED');
});

it('returns OTP_RESEND_COOLDOWN with retry_after_seconds when a code was just sent', function () {
    sendRegisterOtp('new@example.test')->assertAccepted();

    // IP lain supaya rate limiter per identifier+IP tidak lebih dulu menjawab 429.
    sendRegisterOtp('new@example.test', '10.0.0.2')
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'OTP_RESEND_COOLDOWN')
        ->assertJsonPath('error.details.retry_after_seconds', 60);
});

it('returns OTP_INVALID with attempts_remaining, then OTP_MAX_ATTEMPTS, then OTP_EXPIRED', function () {
    sendRegisterOtp('new@example.test')->assertAccepted();
    $wrong = mailedOtp() === '000000' ? '111111' : '000000';

    verifyRegisterOtp('new@example.test', $wrong)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'OTP_INVALID')
        ->assertJsonPath('error.details.attempts_remaining', 4);

    foreach (range(2, 4) as $attempt) {
        verifyRegisterOtp('new@example.test', $wrong)->assertJsonPath('error.code', 'OTP_INVALID');
    }

    verifyRegisterOtp('new@example.test', $wrong)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'OTP_MAX_ATTEMPTS');

    // Kode sudah hangus → tidak ada kode aktif.
    verifyRegisterOtp('new@example.test', $wrong)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'OTP_EXPIRED');
});

it('returns OTP_EXPIRED after the code lifetime has passed', function () {
    sendRegisterOtp('new@example.test')->assertAccepted();
    $code = mailedOtp();
    OtpCode::query()->update(['expires_at' => now()->subSecond()]);

    verifyRegisterOtp('new@example.test', $code)->assertJsonPath('error.code', 'OTP_EXPIRED');
});

it('returns VERIFICATION_TOKEN_INVALID for a missing or reused registration token', function () {
    $this->postJson('/api/v1/auth/register/umkm', [
        'business_name' => 'Toko', 'email' => 'new@example.test',
        'verification_token' => str_repeat('a', 64), 'password' => 'correct horse battery',
    ])->assertUnprocessable()->assertJsonPath('error.code', 'VERIFICATION_TOKEN_INVALID');
});

it('returns CAMPUS_EMAIL_DOMAIN_MISMATCH when the campus email does not match the university', function () {
    $university = University::query()->create(['name' => 'Kampus', 'email_domain' => 'kampus.ac.id']);
    sendRegisterOtp('nadia@example.test')->assertAccepted();
    $token = verifyRegisterOtp('nadia@example.test', mailedOtp())->json('data.verification_token');

    $this->postJson('/api/v1/auth/register/student', [
        'name' => 'Nadia', 'email' => 'nadia@example.test', 'verification_token' => $token,
        'password' => 'correct horse battery', 'university_id' => $university->id,
        'campus_email' => 'nadia@lain.ac.id',
    ])->assertUnprocessable()->assertJsonPath('error.code', 'CAMPUS_EMAIL_DOMAIN_MISMATCH');
});

it('returns the same INVALID_CREDENTIALS response for unknown, wrong password and suspended accounts', function () {
    User::factory()->create(['email' => 'active@example.test', 'password_hash' => 'correct horse battery', 'status' => 'ACTIVE']);
    User::factory()->create(['email' => 'suspended@example.test', 'password_hash' => 'correct horse battery', 'status' => 'SUSPENDED']);

    $responses = [
        $this->postJson('/api/v1/auth/login', ['identifier' => 'ghost@example.test', 'password' => 'correct horse battery']),
        $this->postJson('/api/v1/auth/login', ['identifier' => 'active@example.test', 'password' => 'wrong password']),
        $this->postJson('/api/v1/auth/login', ['identifier' => 'suspended@example.test', 'password' => 'correct horse battery']),
    ];

    foreach ($responses as $response) {
        $response->assertUnauthorized()->assertJsonPath('error.code', 'INVALID_CREDENTIALS');
    }
    expect($responses[1]->json('error'))->toBe($responses[0]->json('error'))
        ->and($responses[2]->json('error'))->toBe($responses[0]->json('error'));
});

it('returns SERVICE_UNAVAILABLE when the OTP cannot be delivered', function () {
    // Kredensial Meta kosong → MetaWhatsAppOtpSender melempar error saat mengirim.
    config(['services.meta_whatsapp.access_token' => null]);

    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'whatsapp', 'identifier' => '+6281234567890'])
        ->assertStatus(503)
        ->assertJsonPath('error.code', 'SERVICE_UNAVAILABLE');
    expect(OtpCode::query()->count())->toBe(0);
});

it('keeps password reset OTP responses free of account-revealing codes', function () {
    User::factory()->create(['email' => 'nadia@example.test', 'status' => 'ACTIVE']);

    $known = $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'nadia@example.test'])->assertAccepted();
    $unknown = $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'ghost@example.test'])->assertAccepted();
    expect(array_keys($unknown->json('data')))->toBe(array_keys($known->json('data')));

    $verifyKnown = $this->postJson('/api/v1/auth/password/otp/verify', ['channel' => 'email', 'identifier' => 'nadia@example.test', 'code' => '000000']);
    $verifyUnknown = $this->postJson('/api/v1/auth/password/otp/verify', ['channel' => 'email', 'identifier' => 'ghost@example.test', 'code' => '000000']);
    $verifyKnown->assertUnprocessable()->assertJsonPath('error.code', 'OTP_INVALID')->assertJsonPath('error.details', []);
    expect($verifyUnknown->json('error'))->toBe($verifyKnown->json('error'));

    $this->postJson('/api/v1/auth/password/reset', [
        'channel' => 'email', 'identifier' => 'ghost@example.test', 'reset_token' => str_repeat('a', 64),
        'password' => 'new password 456', 'password_confirmation' => 'new password 456',
    ])->assertUnprocessable()->assertJsonPath('error.code', 'RESET_TOKEN_INVALID');
});

it('returns specific codes for student identity verification rules', function () {
    $university = University::query()->create(['name' => 'Kampus', 'email_domain' => 'kampus.ac.id']);
    $user = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION']);
    $student = StudentProfile::query()->create(['user_id' => $user->id, 'university_id' => $university->id]);
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/students/me/campus-email/verification')
        ->assertUnprocessable()->assertJsonPath('error.code', 'CAMPUS_EMAIL_NOT_SET');

    $admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
    Auth::forgetGuards();
    $this->withToken($admin->createToken('test')->plainTextToken)
        ->postJson('/api/v1/admin/verifications/'.$student->id.'/approve', ['type' => 'STUDENT_KTM'])
        ->assertUnprocessable()->assertJsonPath('error.code', 'KTM_VERIFICATION_NOT_PENDING');

    $student->forceFill(['campus_email' => 'nadia@kampus.ac.id', 'campus_email_verified_at' => now()])->save();
    Auth::forgetGuards();
    $this->withToken($token)->postJson('/api/v1/students/me/verification', [
        'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 test'),
    ])->assertUnprocessable()->assertJsonPath('error.code', 'KTM_VERIFICATION_NOT_ALLOWED');
});
