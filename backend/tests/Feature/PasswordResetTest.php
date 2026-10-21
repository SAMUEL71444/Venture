<?php

use App\Models\OtpCode;
use App\Models\RefreshToken;
use App\Models\User;
use App\Modules\auth\Mail\OtpCodeMail;
use Illuminate\Http\Client\Request;
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

function resetUser(array $attributes = []): User
{
    return User::factory()->create([
        'email' => 'nadia@example.test',
        'phone' => '+6281234567890',
        'password_hash' => 'old password 123',
        'role' => 'STUDENT',
        'status' => 'ACTIVE',
        ...$attributes,
    ]);
}

function lastMailedCode(): string
{
    $code = null;
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$code) {
        $code = $mail->code;

        return true;
    });

    return $code;
}

/** Kirim + verifikasi OTP reset via email, kembalikan reset_token. */
function resetToken(string $email = 'nadia@example.test'): string
{
    test()->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => $email])->assertAccepted();

    return test()->postJson('/api/v1/auth/password/otp/verify', [
        'channel' => 'email',
        'identifier' => $email,
        'code' => lastMailedCode(),
    ])->assertOk()->json('data.reset_token');
}

function resetPassword(string $token, array $overrides = [])
{
    return test()->postJson('/api/v1/auth/password/reset', [
        'channel' => 'email',
        'identifier' => 'nadia@example.test',
        'reset_token' => $token,
        'password' => 'new password 456',
        'password_confirmation' => 'new password 456',
        ...$overrides,
    ]);
}

it('resets the password over email and revokes every session', function () {
    $user = resetUser();
    $login = $this->postJson('/api/v1/auth/login', ['identifier' => 'nadia@example.test', 'password' => 'old password 123'])
        ->assertOk()->json('data.tokens');

    $verify = $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'NADIA@example.test'])
        ->assertAccepted();
    expect($verify->json('data'))->toHaveKeys(['expires_at', 'resend_after_seconds']);

    $tokenResponse = $this->postJson('/api/v1/auth/password/otp/verify', [
        'channel' => 'email', 'identifier' => 'nadia@example.test', 'code' => lastMailedCode(),
    ])->assertOk()->assertJsonPath('data.expires_in_seconds', 15 * 60);

    resetPassword($tokenResponse->json('data.reset_token'))
        ->assertOk()
        ->assertJsonPath('data.password_reset', true);

    expect($user->tokens()->count())->toBe(0)
        ->and(RefreshToken::query()->where('user_id', $user->id)->whereNull('revoked_at')->count())->toBe(0)
        ->and(OtpCode::query()->firstOrFail()->verification_token_hash)->toBeNull();

    $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $login['refresh_token']])->assertUnauthorized();
    $this->postJson('/api/v1/auth/login', ['identifier' => 'nadia@example.test', 'password' => 'old password 123'])->assertUnauthorized();
    $this->postJson('/api/v1/auth/login', ['identifier' => 'nadia@example.test', 'password' => 'new password 456'])->assertOk();
    $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET', 'entity_id' => $user->id]);
});

it('resets the password over WhatsApp', function () {
    resetUser();
    $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'whatsapp', 'identifier' => '+6281234567890'])->assertAccepted();

    $code = null;
    Http::assertSent(function (Request $request) use (&$code) {
        $code = $request->data()['template']['components'][0]['parameters'][0]['text'];

        return $request['to'] === '6281234567890';
    });

    $token = $this->postJson('/api/v1/auth/password/otp/verify', [
        'channel' => 'whatsapp', 'identifier' => '+6281234567890', 'code' => $code,
    ])->assertOk()->json('data.reset_token');

    resetPassword($token, ['channel' => 'whatsapp', 'identifier' => '+6281234567890'])->assertOk();
    $this->postJson('/api/v1/auth/login', ['identifier' => '+6281234567890', 'password' => 'new password 456'])->assertOk();
});

it('answers OTP send identically whether or not the account exists', function () {
    resetUser();
    $known = $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'nadia@example.test']);
    $unknown = $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'ghost@example.test']);

    expect($unknown->status())->toBe($known->status())
        ->and(array_keys($unknown->json('data')))->toBe(array_keys($known->json('data')))
        ->and($unknown->json('data.resend_after_seconds'))->toBe($known->json('data.resend_after_seconds'));
    Mail::assertSentCount(1);
    expect(OtpCode::query()->where('identifier', 'ghost@example.test')->exists())->toBeFalse();
});

it('does not send a reset code to suspended accounts and blocks the reset itself', function () {
    $user = resetUser(['status' => 'SUSPENDED']);
    $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'nadia@example.test'])->assertAccepted();
    Mail::assertNothingSent();

    // Akun ditangguhkan setelah OTP diverifikasi.
    $user->forceFill(['status' => 'ACTIVE'])->save();
    $this->travel(2)->minutes();
    $token = resetToken();
    $user->forceFill(['status' => 'SUSPENDED'])->save();

    resetPassword($token)->assertForbidden()->assertJsonPath('error.code', 'ACCOUNT_SUSPENDED');
    $this->postJson('/api/v1/auth/login', ['identifier' => 'nadia@example.test', 'password' => 'new password 456'])->assertUnauthorized();
    expect(\Illuminate\Support\Facades\Hash::check('old password 123', $user->fresh()->password_hash))->toBeTrue();
});

it('accepts a reset token once, only for its identifier and purpose, and for 15 minutes', function () {
    resetUser();
    resetUser(['email' => 'other@example.test', 'phone' => '+6281234567891']);
    $token = resetToken();

    resetPassword($token, ['identifier' => 'other@example.test'])->assertUnprocessable()->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');
    resetPassword($token, ['channel' => 'whatsapp', 'identifier' => '+6281234567890'])->assertUnprocessable();

    $this->travel(14)->minutes();
    resetPassword($token)->assertOk();
    resetPassword($token)->assertUnprocessable()->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');
});

it('expires the reset token after 15 minutes', function () {
    resetUser();
    $token = resetToken();

    $this->travel(16)->minutes();
    resetPassword($token)->assertUnprocessable()->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');
});

it('does not accept a registration verification token as a reset token', function () {
    resetUser();
    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'fresh@example.test'])->assertAccepted();
    $registrationToken = $this->postJson('/api/v1/auth/otp/verify', [
        'channel' => 'email', 'identifier' => 'fresh@example.test', 'code' => lastMailedCode(),
    ])->assertOk()->json('data.verification_token');

    resetPassword($registrationToken, ['identifier' => 'fresh@example.test'])->assertUnprocessable();
});

it('applies the registration password rules', function () {
    resetUser();
    $token = resetToken();

    resetPassword($token, ['password' => 'short', 'password_confirmation' => 'short'])
        ->assertUnprocessable()->assertJsonValidationErrors(['password'], 'error.details');
    resetPassword($token, ['password_confirmation' => 'different password'])
        ->assertUnprocessable()->assertJsonValidationErrors(['password'], 'error.details');
    resetPassword($token)->assertOk();
});

it('gives a uniform error for a wrong reset code without revealing remaining attempts', function () {
    resetUser();
    $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'nadia@example.test'])->assertAccepted();

    $known = $this->postJson('/api/v1/auth/password/otp/verify', ['channel' => 'email', 'identifier' => 'nadia@example.test', 'code' => '000000'])
        ->assertUnprocessable();
    $unknown = $this->postJson('/api/v1/auth/password/otp/verify', ['channel' => 'email', 'identifier' => 'ghost@example.test', 'code' => '000000'])
        ->assertUnprocessable();

    expect($known->json('error'))->toBe($unknown->json('error'));
});

it('rate limits password reset endpoints with their own limiters', function () {
    $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'ghost@example.test'])->assertAccepted();
    $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'ghost@example.test'])
        ->assertStatus(429)->assertJsonPath('error.code', 'TOO_MANY_REQUESTS')->assertHeader('Retry-After');

    foreach (range(1, 5) as $attempt) {
        resetPassword(str_repeat('a', 64), ['identifier' => 'ghost@example.test'])->assertUnprocessable();
    }
    resetPassword(str_repeat('a', 64), ['identifier' => 'ghost@example.test'])->assertStatus(429);
});
