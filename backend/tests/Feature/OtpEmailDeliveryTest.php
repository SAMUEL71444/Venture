<?php

use App\Models\OtpCode;
use App\Models\User;
use App\Modules\auth\Mail\CampusEmailVerificationMail;
use App\Modules\auth\Mail\OtpCodeMail;
use App\Modules\auth\Notifications\VerifyCampusEmailNotification;
use App\Modules\auth\Services\OtpService;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

beforeEach(function () {
    Http::fake();
});

it('sends OTP email through the mailer when MAIL_MAILER is not log, regardless of APP_ENV', function () {
    Mail::fake();
    Log::spy();
    app()->detectEnvironment(fn () => 'local');
    config(['mail.default' => 'smtp']);

    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'nadia@example.test'])->assertAccepted();

    $code = null;
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$code) {
        $code = $mail->code;

        return $mail->hasTo('nadia@example.test');
    });
    // Kode tidak pernah ditulis ke log saat mailer asli dipakai.
    Log::shouldNotHaveReceived('info');
    expect(OtpCode::query()->count())->toBe(1);
});

it('writes the OTP to the log instead of mailing it when MAIL_MAILER is log', function () {
    Mail::fake();
    Log::spy();
    app()->detectEnvironment(fn () => 'local');
    config(['mail.default' => 'log']);

    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'nadia@example.test'])->assertAccepted();

    Mail::assertNothingSent();
    Log::shouldHaveReceived('info')->withArgs(fn (string $message) => str_starts_with($message, '[OTP lokal] email nadia@example.test (REGISTER): '))->once();
});

it('builds the OTP email in Indonesian with HTML and plain text versions', function () {
    $register = new OtpCodeMail('482913', OtpService::PURPOSE_REGISTER, 5);
    $register->assertHasSubject('Kode verifikasi Digital.in');
    $register->assertSeeInHtml('482913');
    $register->assertSeeInHtml('Kode berlaku 5 menit');
    $register->assertSeeInHtml('abaikan saja email ini');
    $register->assertSeeInText('Kode: 482913');
    $register->assertSeeInText('Kode berlaku 5 menit');
    $register->assertSeeInText('abaikan saja email ini');

    $reset = new OtpCodeMail('482913', OtpService::PURPOSE_PASSWORD_RESET, 5);
    $reset->assertHasSubject('Kode reset kata sandi Digital.in');
    $reset->assertSeeInText('mengatur ulang kata sandi');
});

it('builds the campus email verification mail in Indonesian with HTML and plain text versions', function () {
    $mail = (new VerifyCampusEmailNotification('https://digitalin.test/verify/abc'))
        ->toMail((new AnonymousNotifiable)->route('mail', 'nadia@kampus.ac.id'));

    expect($mail)->toBeInstanceOf(CampusEmailVerificationMail::class)
        ->and($mail->hasTo('nadia@kampus.ac.id'))->toBeTrue();
    $mail->assertHasSubject('Verifikasi email kampus Digital.in');
    $mail->assertSeeInHtml('Verifikasi email kampus');
    $mail->assertSeeInHtml('https://digitalin.test/verify/abc', false);
    $mail->assertSeeInText('Tautan berlaku 60 menit');
    $mail->assertDontSeeInText('Regards');
    $mail->assertDontSeeInHtml('having trouble');
});

it('returns SERVICE_UNAVAILABLE and logs without the OTP when SMTP delivery fails', function () {
    Log::spy();
    // SMTP sungguhan ke port yang tertutup → koneksi ditolak.
    config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 1, 'mail.mailers.smtp.timeout' => 2]);

    $this->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => 'nadia@example.test'])
        ->assertStatus(503)
        ->assertJsonPath('error.code', 'SERVICE_UNAVAILABLE');

    expect(OtpCode::query()->count())->toBe(0);
    Log::shouldHaveReceived('error')->withArgs(fn (string $message, array $context) => $message === 'OTP delivery failed.'
        && $context['channel'] === 'email' && ! preg_match('/\b\d{6}\b/', $context['error']))->once();
    Log::shouldNotHaveReceived('info');
});

it('keeps the password reset response identical when SMTP delivery fails', function () {
    Log::spy();
    User::factory()->create(['email' => 'nadia@example.test', 'status' => 'ACTIVE']);
    config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 1, 'mail.mailers.smtp.timeout' => 2]);

    $known = $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'nadia@example.test'])->assertAccepted();
    $unknown = $this->postJson('/api/v1/auth/password/otp/send', ['channel' => 'email', 'identifier' => 'ghost@example.test'])->assertAccepted();

    expect(array_keys($known->json('data')))->toBe(array_keys($unknown->json('data')));
    Log::shouldHaveReceived('error')->withArgs(fn (string $message) => $message === 'OTP delivery failed.')->once();
});
