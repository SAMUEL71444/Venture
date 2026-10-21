<?php

use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\auth\Mail\OtpCodeMail;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Http::fake();
    Mail::fake();
});

/** OTP email → verification_token untuk registrasi. */
function catalogVerificationToken(string $email): string
{
    test()->postJson('/api/v1/auth/otp/send', ['channel' => 'email', 'identifier' => $email])->assertAccepted();
    $code = null;
    Mail::assertSent(OtpCodeMail::class, function (OtpCodeMail $mail) use (&$code) {
        $code = $mail->code;

        return true;
    });

    return test()->postJson('/api/v1/auth/otp/verify', ['channel' => 'email', 'identifier' => $email, 'code' => $code])
        ->assertOk()->json('data.verification_token');
}

function registerCatalogStudent(array $fields, string $email = 'nadia@example.test')
{
    return test()->postJson('/api/v1/auth/register/student', [
        'name' => 'Nadia',
        'email' => $email,
        'verification_token' => catalogVerificationToken($email),
        'password' => 'correct horse battery',
        ...$fields,
    ]);
}

function catalogFile(array $rows): string
{
    $path = tempnam(sys_get_temp_dir(), 'universities').'.json';
    file_put_contents($path, json_encode($rows));

    return $path;
}

// --- impor ------------------------------------------------------------------------

it('imports the bundled catalog idempotently', function () {
    $rows = json_decode(file_get_contents(database_path('data/universities_id.json')), true);
    $nullDomains = count(array_filter($rows, fn ($row) => $row['email_domain'] === null));

    expect(Artisan::call('universities:import'))->toBe(0);
    expect(University::query()->count())->toBe(100)
        ->and(University::query()->whereNull('email_domain')->count())->toBe($nullDomains)
        ->and(University::query()->where('is_partner', true)->count())->toBe(0)
        ->and(University::query()->where('name', 'Institut Teknologi Bandung')->value('short_name'))->toBe('ITB');

    expect(Artisan::call('universities:import'))->toBe(0);
    expect(Artisan::output())->toContain('0 created, 0 updated');
    expect(University::query()->count())->toBe(100);
});

it('never overwrites is_partner or existing values and only fills empty columns', function () {
    $existing = University::query()->create([
        'name' => 'Universitas Contoh', 'email_domain' => 'contoh.ac.id', 'city' => 'Kota Pilihan Admin', 'is_partner' => true,
    ]);

    Artisan::call('universities:import', ['--path' => catalogFile([[
        'name' => 'UNIVERSITAS CONTOH', 'short_name' => 'UC', 'city' => 'Kota Lain', 'province' => 'Jawa Barat', 'email_domain' => 'lain.ac.id',
    ]])]);

    $existing->refresh();
    expect(University::query()->count())->toBe(1)
        ->and($existing->is_partner)->toBeTrue()
        ->and($existing->city)->toBe('Kota Pilihan Admin')
        ->and($existing->email_domain)->toBe('contoh.ac.id')
        ->and($existing->name)->toBe('Universitas Contoh')
        ->and($existing->short_name)->toBe('UC')
        ->and($existing->province)->toBe('Jawa Barat');
});

it('skips an email_domain that already belongs to another university', function () {
    University::query()->create(['name' => 'Kampus Lama', 'email_domain' => 'sama.ac.id']);

    Artisan::call('universities:import', ['--path' => catalogFile([
        ['name' => 'Kampus Baru', 'short_name' => 'KB', 'city' => 'Bandung', 'province' => 'Jawa Barat', 'email_domain' => 'sama.ac.id'],
    ])]);

    expect(University::query()->where('name', 'Kampus Baru')->value('email_domain'))->toBeNull()
        ->and(Artisan::output())->toContain('already used');
});

it('rejects a catalog file with invalid rows', function () {
    expect(Artisan::call('universities:import', ['--path' => catalogFile([['name' => '', 'email_domain' => 'bukan domain']])]))->toBe(1);
    expect(University::query()->count())->toBe(0);
});

it('allows several universities without email_domain but keeps names unique', function () {
    University::query()->create(['name' => 'Kampus A']);
    University::query()->create(['name' => 'Kampus B']);

    expect(fn () => University::query()->create(['name' => 'Kampus A']))->toThrow(QueryException::class);
});

// --- endpoint daftar ---------------------------------------------------------------

it('lists universities with only id, name, short_name and city sorted by name', function () {
    University::query()->create(['name' => 'Universitas Zeta', 'short_name' => 'UZ', 'city' => 'Medan', 'email_domain' => 'zeta.ac.id', 'is_partner' => true]);
    University::query()->create(['name' => 'Institut Alfa', 'short_name' => 'IA', 'city' => 'Bandung']);

    $data = $this->getJson('/api/v1/universities')->assertOk()->json('data');

    expect(array_column($data, 'name'))->toBe(['Institut Alfa', 'Universitas Zeta'])
        ->and(array_keys($data[0]))->toEqualCanonicalizing(['id', 'name', 'short_name', 'city']);
});

// --- registrasi ---------------------------------------------------------------------

it('registers a student with a university from the list', function () {
    $university = University::query()->create(['name' => 'Kampus', 'email_domain' => 'kampus.ac.id']);

    registerCatalogStudent(['university_id' => $university->id])->assertCreated();

    $profile = StudentProfile::query()->firstOrFail();
    expect($profile->university_id)->toBe($university->id)
        ->and($profile->university_name_custom)->toBeNull();
});

it('registers a student with a typed university name without creating a university row', function () {
    registerCatalogStudent(['university_name_custom' => "  Sekolah Tinggi   Contoh\tNusantara  "])
        ->assertCreated()
        ->assertJsonPath('data.profile.university_name_custom', 'Sekolah Tinggi Contoh Nusantara');

    $profile = StudentProfile::query()->firstOrFail();
    expect($profile->university_id)->toBeNull()
        ->and(University::query()->count())->toBe(0);
});

it('requires exactly one of university_id or university_name_custom', function () {
    $university = University::query()->create(['name' => 'Kampus', 'email_domain' => 'kampus.ac.id']);

    registerCatalogStudent([], 'a@example.test')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['university_id', 'university_name_custom'], 'error.details');

    registerCatalogStudent(['university_name_custom' => '   '], 'b@example.test')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['university_id', 'university_name_custom'], 'error.details');

    registerCatalogStudent(['university_id' => $university->id, 'university_name_custom' => 'Kampus Lain'], 'c@example.test')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['university_id'], 'error.details');

    expect(StudentProfile::query()->count())->toBe(0);
});

it('limits a typed university name to 150 characters', function () {
    registerCatalogStudent(['university_name_custom' => str_repeat('a', 151)], 'a@example.test')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['university_name_custom'], 'error.details');

    registerCatalogStudent(['university_name_custom' => str_repeat('a', 150)], 'b@example.test')->assertCreated();
});

// --- email kampus -------------------------------------------------------------------

it('accepts campus emails on the university domain or its subdomains only', function () {
    $itb = University::query()->create(['name' => 'Institut Teknologi Bandung', 'email_domain' => 'itb.ac.id']);

    registerCatalogStudent(['university_id' => $itb->id, 'campus_email' => 'x@mahasiswa.itb.ac.id'], 'a@example.test')
        ->assertCreated();

    registerCatalogStudent(['university_id' => $itb->id, 'campus_email' => 'x@evilitb.ac.id'], 'b@example.test')
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'CAMPUS_EMAIL_DOMAIN_MISMATCH');
});

it('returns CAMPUS_EMAIL_NOT_AVAILABLE at registration for typed or domain-less universities', function () {
    $noDomain = University::query()->create(['name' => 'Kampus Tanpa Domain']);

    registerCatalogStudent(['university_name_custom' => 'Kampus Lain', 'campus_email' => 'x@lain.ac.id'], 'a@example.test')
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'CAMPUS_EMAIL_NOT_AVAILABLE')
        ->assertJsonPath('error.details.verification_method', 'KTM');

    registerCatalogStudent(['university_id' => $noDomain->id, 'campus_email' => 'x@tanpa.ac.id'], 'b@example.test')
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'CAMPUS_EMAIL_NOT_AVAILABLE');
});

it('rejects campus email verification for typed or domain-less universities', function () {
    $noDomain = University::query()->create(['name' => 'Kampus Tanpa Domain']);

    foreach ([['university_name_custom' => 'Kampus Lain'], ['university_id' => $noDomain->id]] as $university) {
        $user = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION']);
        StudentProfile::query()->create(['user_id' => $user->id, ...$university]);
        Auth::forgetGuards();

        $this->withToken($user->createToken('test')->plainTextToken)
            ->postJson('/api/v1/students/me/campus-email/verification')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'CAMPUS_EMAIL_NOT_AVAILABLE')
            ->assertJsonPath('error.details.verification_method', 'KTM');
    }
});

// --- antrean verifikasi admin ---------------------------------------------------------

it('shows the typed university name in the admin verification queue', function () {
    Storage::fake('private');
    $user = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION']);
    StudentProfile::query()->create(['user_id' => $user->id, 'university_name_custom' => 'Sekolah Tinggi Contoh']);

    $this->withToken($user->createToken('test')->plainTextToken)
        ->postJson('/api/v1/students/me/verification', [
            'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 test'),
        ])->assertAccepted();

    $admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
    Auth::forgetGuards();
    $queue = $this->withToken($admin->createToken('test')->plainTextToken)
        ->getJson('/api/v1/admin/verifications')->assertOk()->json('data');

    $student = collect($queue)->firstWhere('type', 'STUDENT_KTM');
    expect($student['university_id'])->toBeNull()
        ->and($student['university_name_custom'])->toBe('Sekolah Tinggi Contoh');
});
