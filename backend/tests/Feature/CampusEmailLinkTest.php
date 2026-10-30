<?php

use App\Models\AuditLog;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\auth\Notifications\VerifyCampusEmailNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

// Tautan verifikasi email kampus dibuka dari email (browser): tidak boleh menampilkan JSON,
// tetapi diarahkan ke halaman frontend /verify/campus-email?status=...

const FRONTEND = 'https://app.digitalin.test';

beforeEach(function () {
    config(['app.frontend_url' => FRONTEND]);
    $university = University::query()->create(['name' => 'Kampus Contoh', 'email_domain' => 'contoh.ac.id']);
    $this->user = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION']);
    $this->student = StudentProfile::query()->create([
        'user_id' => $this->user->id, 'university_id' => $university->id,
        'campus_email' => 'nadia@contoh.ac.id', 'verification_status' => 'PENDING',
    ]);
});

function campusLink(StudentProfile $student, int $minutes = 60, ?string $hash = null): string
{
    return URL::temporarySignedRoute('auth.email.verify', now()->addMinutes($minutes), [
        'profile' => $student->id, 'hash' => $hash ?? sha1($student->campus_email),
    ]);
}

function expectStatusRedirect($response, string $status): void
{
    $response->assertRedirect(FRONTEND.'/verify/campus-email?status='.$status)
        ->assertHeader('Referrer-Policy', 'no-referrer');
    expect($response->getContent())->not->toContain('"error"');
}

it('verifies the student and redirects to status=success', function () {
    expectStatusRedirect($this->get(campusLink($this->student)), 'success');

    expect($this->student->fresh()->verification_status)->toBe('VERIFIED')
        ->and($this->student->fresh()->campus_email_verified_at)->not->toBeNull()
        ->and($this->user->fresh()->status)->toBe('ACTIVE')
        ->and(AuditLog::query()->where('action', 'STUDENT_CAMPUS_EMAIL_VERIFIED')->count())->toBe(1);
});

it('treats a second click on the same link as already_verified, not an error', function () {
    $link = campusLink($this->student);
    $this->get($link);

    expectStatusRedirect($this->get($link), 'already_verified');
    expect(AuditLog::query()->where('action', 'STUDENT_CAMPUS_EMAIL_VERIFIED')->count())->toBe(1);
});

it('shows already_verified when the account was approved through KTM before the link was clicked', function () {
    Storage::fake('private');
    $link = campusLink($this->student);
    $this->withToken($this->user->createToken('s')->plainTextToken)->postJson('/api/v1/students/me/verification', [
        'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 ktm'),
    ])->assertAccepted();
    Auth::forgetGuards();
    $this->flushHeaders()->withToken(User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE'])->createToken('a')->plainTextToken)
        ->postJson("/api/v1/admin/verifications/{$this->student->id}/approve", ['type' => 'STUDENT_KTM'])->assertOk();
    Auth::forgetGuards();

    expectStatusRedirect($this->flushHeaders()->get($link), 'already_verified');
    // Verifikasi lewat KTM tidak ditimpa: email kampus tidak dianggap terverifikasi.
    expect($this->student->fresh()->campus_email_verified_at)->toBeNull()
        ->and($this->user->fresh()->status)->toBe('ACTIVE')
        ->and(AuditLog::query()->where('action', 'STUDENT_CAMPUS_EMAIL_VERIFIED')->exists())->toBeFalse();
});

it('redirects an expired link to status=expired without verifying', function () {
    expectStatusRedirect($this->get(campusLink($this->student, minutes: -1)), 'expired');

    expect($this->student->fresh()->verification_status)->toBe('PENDING')
        ->and($this->user->fresh()->status)->toBe('PENDING_VERIFICATION');
});

it('still reports already_verified for an expired link when verification is already done', function () {
    $this->student->forceFill(['verification_status' => 'VERIFIED'])->save();

    expectStatusRedirect($this->get(campusLink($this->student, minutes: -1)), 'already_verified');
});

it('redirects tampered, mismatched or unknown links to status=invalid without verifying', function () {
    $link = campusLink($this->student);
    expectStatusRedirect($this->get($link.'0'), 'invalid');
    expectStatusRedirect($this->get(campusLink($this->student, hash: sha1('lain@contoh.ac.id'))), 'invalid');

    $other = StudentProfile::query()->make(['campus_email' => 'x@contoh.ac.id']);
    $other->id = '0192f3a1-0000-7000-8000-000000000000';
    expectStatusRedirect($this->get(campusLink($other)), 'invalid');

    expect($this->student->fresh()->verification_status)->toBe('PENDING');
});

it('redirects a rejected student to status=rejected and never activates the account', function () {
    $this->student->forceFill(['verification_status' => 'REJECTED'])->save();

    expectStatusRedirect($this->get(campusLink($this->student)), 'rejected');
    expect($this->student->fresh()->verification_status)->toBe('REJECTED')
        ->and($this->user->fresh()->status)->toBe('PENDING_VERIFICATION');
});

it('keeps the JSON API behaviour for JSON clients', function () {
    $link = campusLink($this->student);

    $this->getJson($link.'0')->assertForbidden();
    $this->getJson(campusLink($this->student, minutes: -1))->assertForbidden();
    $this->getJson($link)->assertOk()->assertJsonPath('data.verified', true);
    $this->getJson($link)->assertStatus(409)->assertJsonPath('error.code', 'INVALID_STATE_TRANSITION');
});

it('redirects relative to the link host when FRONTEND_URL is "/" (demo: one tunnel via the Next.js proxy)', function () {
    config(['app.frontend_url' => '/']);

    $this->get(campusLink($this->student))->assertRedirect('/verify/campus-email?status=success');
});

/** Kirim ulang tautan lewat API (seperti dari frontend) dan ambil URL yang masuk ke email. */
function sentCampusLink(array $headers = []): string
{
    Notification::fake();
    test()->withHeaders($headers)->withToken(test()->user->createToken('s')->plainTextToken)
        ->postJson('http://127.0.0.1:8000/api/v1/students/me/campus-email/verification')->assertAccepted();
    Auth::forgetGuards();
    test()->flushHeaders();

    $link = null;
    Notification::assertSentOnDemand(VerifyCampusEmailNotification::class, function ($notification, $channels, $notifiable) use (&$link) {
        $link = $notification->toMail($notifiable)->verificationUrl;

        return true;
    });

    return $link;
}

// Seperti dari proxy Next.js: Host = backend lokal, host publik di X-Forwarded-Host, skema dari Cloudflare.
const TUNNEL_HEADERS = ['X-Forwarded-Host' => 'demo-abc.trycloudflare.com', 'X-Forwarded-Proto' => 'https', 'X-Forwarded-For' => '203.0.113.9'];

it('uses APP_URL for the email link in a normal deploy, even if the request carries another host', function () {
    config(['app.url' => 'https://api.digitalin.test', 'app.links_use_request_host' => false, 'trustedproxy.proxies' => '*']);

    $link = sentCampusLink(['X-Forwarded-Host' => 'evil.example', 'X-Forwarded-Proto' => 'https']);

    expect($link)->toStartWith('https://api.digitalin.test/api/v1/auth/email/verify/');
});

it('keeps the signature valid whatever host or scheme the click arrives through (relative signature)', function () {
    config(['app.url' => 'https://api.digitalin.test', 'app.links_use_request_host' => false]);
    $link = sentCampusLink();

    // Mis. TLS diakhiri load balancer: backend melihat http://127.0.0.1:8000, bukan https://api.digitalin.test.
    $this->get('http://127.0.0.1:8000'.substr($link, strlen('https://api.digitalin.test')))
        ->assertRedirect(FRONTEND.'/verify/campus-email?status=success');
    expect($this->student->fresh()->verification_status)->toBe('VERIFIED');
});

it('rejects a relative link whose path or query was altered', function () {
    config(['app.url' => 'https://api.digitalin.test']);
    $link = sentCampusLink();
    $path = substr($link, strlen('https://api.digitalin.test'));

    $this->get($path.'1')->assertRedirect(FRONTEND.'/verify/campus-email?status=invalid');
    $this->get(preg_replace('/expires=\d+/', 'expires='.(now()->addYear()->timestamp), $path))
        ->assertRedirect(FRONTEND.'/verify/campus-email?status=invalid');
    $this->getJson($path.'1')->assertForbidden();
    expect($this->student->fresh()->verification_status)->toBe('PENDING');
});

it('demo mode: builds the link from the trusted forwarded tunnel host and verifies through the Next.js + Cloudflare proxy', function () {
    config(['app.links_use_request_host' => true, 'trustedproxy.proxies' => '127.0.0.1', 'app.frontend_url' => '/']);

    $link = sentCampusLink(TUNNEL_HEADERS);
    expect($link)->toStartWith('https://demo-abc.trycloudflare.com/api/v1/auth/email/verify/');

    // Klik dari email: lewat tunnel → proxy Next.js → Laravel di 127.0.0.1:8000.
    $this->withHeaders(TUNNEL_HEADERS)->get('http://127.0.0.1:8000'.substr($link, strlen('https://demo-abc.trycloudflare.com')))
        ->assertRedirect('/verify/campus-email?status=success');
    expect($this->student->fresh()->verification_status)->toBe('VERIFIED');
});

it('demo mode without TRUSTED_PROXIES: forwarded host is ignored, so the link would only work on the laptop', function () {
    config(['app.links_use_request_host' => true, 'trustedproxy.proxies' => null]);

    expect(sentCampusLink(TUNNEL_HEADERS))->toStartWith('http://127.0.0.1:8000/api/v1/auth/email/verify/');
});
