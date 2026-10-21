<?php

use App\Models\OtpCode;
use App\Models\University;
use App\Models\User;
use App\Modules\auth\Mail\OtpCodeMail;
use App\Modules\auth\Services\LogOtpSender;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;

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

/** Kirim + verifikasi OTP registrasi, kembalikan verification_token. */
function registrationToken(string $channel, string $identifier): string
{
    test()->postJson('/api/v1/auth/otp/send', ['channel' => $channel, 'identifier' => $identifier])->assertAccepted();

    $code = null;
    if ($channel === 'email') {
        Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$code) {
            $code = $mail->code;

            return true;
        });
    } else {
        Http::assertSent(function (Request $request) use (&$code) {
            $code = $request->data()['template']['components'][0]['parameters'][0]['text'];

            return true;
        });
    }

    return test()->postJson('/api/v1/auth/otp/verify', [
        'channel' => $channel,
        'identifier' => $identifier,
        'code' => $code,
    ])->assertOk()->json('data.verification_token');
}

it('adds channel and identifier to otp_codes and keeps users.phone nullable but unique', function () {
    expect(Schema::hasColumns('otp_codes', ['channel', 'identifier', 'purpose', 'phone']))->toBeTrue();

    $email = OtpCode::query()->create([
        'channel' => 'email', 'identifier' => 'a@example.test', 'code_hash' => 'x',
        'purpose' => 'REGISTER', 'expires_at' => now()->addMinute(),
    ]);
    expect($email->fresh()->phone)->toBeNull();

    User::factory()->create(['phone' => null]);
    User::factory()->create(['phone' => null]);
    User::factory()->create(['phone' => '+6281200000001']);

    expect(fn () => User::factory()->create(['phone' => '+6281200000001']))->toThrow(QueryException::class);
});

it('registers an UMKM with an email channel only', function () {
    $token = registrationToken('email', 'Kopi@Example.TEST');

    $this->postJson('/api/v1/auth/register/umkm', [
        'business_name' => 'Kopi Senja',
        'email' => 'kopi@example.test',
        'verification_token' => $token,
        'password' => 'correct horse battery',
    ])->assertCreated()
        ->assertJsonPath('data.user.role', 'UMKM')
        ->assertJsonPath('data.user.status', 'ACTIVE')
        ->assertJsonPath('data.user.email', 'kopi@example.test')
        ->assertJsonPath('data.user.phone', null);

    $user = User::query()->firstOrFail();
    expect($user->email_verified_at)->not->toBeNull()
        ->and($user->phone_verified_at)->toBeNull();
    Http::assertNothingSent();
});

it('registers a student and a mentor with a WhatsApp number only', function () {
    $university = University::query()->create(['name' => 'Kampus Example', 'email_domain' => 'example.ac.id']);

    $this->postJson('/api/v1/auth/register/student', [
        'name' => 'Nadia',
        'phone' => '+6281234567890',
        'verification_token' => registrationToken('whatsapp', '+6281234567890'),
        'password' => 'correct horse battery',
        'university_id' => $university->id,
    ])->assertCreated()
        ->assertJsonPath('data.user.role', 'STUDENT')
        ->assertJsonPath('data.user.status', 'PENDING_VERIFICATION')
        ->assertJsonPath('data.user.email', null);

    $this->postJson('/api/v1/auth/register/mentor', [
        'name' => 'Budi',
        'phone' => '+6281234567891',
        'verification_token' => registrationToken('whatsapp', '+6281234567891'),
        'password' => 'correct horse battery',
        'title' => 'Senior Designer',
        'institution' => 'Studio',
    ])->assertCreated()
        ->assertJsonPath('data.user.role', 'MENTOR');

    expect(User::query()->where('phone', '+6281234567890')->value('phone_verified_at'))->not->toBeNull();
    Mail::assertNothingSent();
});

it('binds the verification token to its channel and identifier and allows one use only', function () {
    $token = registrationToken('email', 'owner@example.test');
    $payload = ['business_name' => 'Toko', 'verification_token' => $token, 'password' => 'correct horse battery'];

    // Identifier lain di kanal yang sama.
    $this->postJson('/api/v1/auth/register/umkm', [...$payload, 'email' => 'other@example.test'])
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');

    // Kanal lain.
    $this->postJson('/api/v1/auth/register/umkm', [...$payload, 'phone' => '+6281234567890'])
        ->assertUnprocessable();

    $this->postJson('/api/v1/auth/register/umkm', [...$payload, 'email' => 'owner@example.test'])->assertCreated();

    // Sekali pakai.
    User::query()->delete();
    $this->postJson('/api/v1/auth/register/umkm', [...$payload, 'email' => 'owner@example.test'])
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');
});

it('rejects duplicate email and phone at OTP send and at registration', function () {
    User::factory()->create(['email' => 'taken@example.test', 'phone' => '+6281234567890']);

    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'TAKEN@example.test'])
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'whatsapp', 'identifier' => '+6281234567890'])
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');

    $this->postJson('/api/v1/auth/register/mentor', [
        'name' => 'X', 'email' => 'taken@example.test', 'verification_token' => str_repeat('a', 64),
        'password' => 'correct horse battery', 'title' => 'T', 'institution' => 'I',
    ])->assertUnprocessable()->assertJsonValidationErrors(['email'], 'error.details');

    $this->postJson('/api/v1/auth/register/mentor', [
        'name' => 'X', 'phone' => '+6281234567890', 'verification_token' => str_repeat('a', 64),
        'password' => 'correct horse battery', 'title' => 'T', 'institution' => 'I',
    ])->assertUnprocessable()->assertJsonValidationErrors(['phone'], 'error.details');
});

it('validates channel, email format and E.164 phone numbers', function () {
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'bukan-email'])
        ->assertUnprocessable()->assertJsonValidationErrors(['identifier'], 'error.details');
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'whatsapp', 'identifier' => '081234567890'])
        ->assertUnprocessable()->assertJsonValidationErrors(['identifier'], 'error.details');
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'sms', 'identifier' => '+6281234567890'])
        ->assertUnprocessable()->assertJsonValidationErrors(['channel'], 'error.details');

    // Registrasi tanpa email maupun nomor HP.
    $this->postJson('/api/v1/auth/register/umkm', [
        'business_name' => 'Toko', 'verification_token' => str_repeat('a', 64), 'password' => 'correct horse battery',
    ])->assertUnprocessable()->assertJsonValidationErrors(['channel', 'email'], 'error.details');

    Mail::assertNothingSent();
    Http::assertNothingSent();
});

it('writes OTP codes for both channels to the log when APP_ENV is local', function () {
    app()->detectEnvironment(fn () => 'local');
    Log::spy();

    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'dev@example.test'])->assertAccepted();
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'whatsapp', 'identifier' => '+6281234567899'])->assertAccepted();

    Log::shouldHaveReceived('info')->withArgs(fn (string $message) => str_starts_with($message, '[OTP lokal] email dev@example.test (REGISTER): '))->once();
    Log::shouldHaveReceived('info')->withArgs(fn (string $message) => str_starts_with($message, '[OTP lokal] whatsapp +6281234567899 (REGISTER): '))->once();
    Mail::assertNothingSent();
    Http::assertNothingSent();
});

it('never writes OTP codes to the log outside the local environment', function () {
    expect(fn () => app(LogOtpSender::class)->send('email', 'a@example.test', '123456', 'REGISTER'))
        ->toThrow(RuntimeException::class);
});

it('rate limits OTP sending per identifier and IP', function () {
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'a@example.test'])->assertAccepted();
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'A@example.test'])
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'TOO_MANY_REQUESTS');

    // Identifier lain dari IP yang sama tetap boleh.
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'b@example.test'])->assertAccepted();
});
