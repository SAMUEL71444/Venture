<?php

use App\Models\StudentProfile;
use App\Models\SubmissionFile;
use App\Models\User;
use App\Support\Demo\DemoAccounts;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    config(['filesystems.sensitive_disks.ktm' => 's3', 'filesystems.sensitive_disks.submissions' => 's3']);
    Storage::fake('s3'); // tidak pernah menghubungi Supabase asli
    Storage::fake('private');
    Storage::fake('local');
});

/** Muat ulang config/filesystems.php dengan env AWS_* sementara (tanpa membaca .env asli), lalu kembalikan env semula. */
function s3DiskConfigWith(array $env): array
{
    $keys = ['AWS_ENDPOINT', 'AWS_USE_PATH_STYLE_ENDPOINT', 'AWS_DEFAULT_REGION', 'AWS_BUCKET'];
    $saved = [];
    foreach ($keys as $key) {
        $saved[$key] = [$_SERVER[$key] ?? null, $_ENV[$key] ?? null, getenv($key)];
        unset($_SERVER[$key], $_ENV[$key]);
        putenv($key);
        if (array_key_exists($key, $env)) {
            $_SERVER[$key] = $_ENV[$key] = $env[$key];
            putenv("{$key}={$env[$key]}");
        }
    }

    try {
        return (require config_path('filesystems.php'))['disks']['s3'];
    } finally {
        foreach ($saved as $key => [$server, $envValue, $putenv]) {
            unset($_SERVER[$key], $_ENV[$key]);
            putenv($key);
            if ($server !== null) {
                $_SERVER[$key] = $server;
            }
            if ($envValue !== null) {
                $_ENV[$key] = $envValue;
            }
            if ($putenv !== false) {
                putenv("{$key}={$putenv}");
            }
        }
    }
}

it('configures Supabase Storage (s3) as a private S3-compatible disk', function () {
    expect(config('filesystems.disks.s3.driver'))->toBe('s3')
        ->and(config('filesystems.disks.s3.visibility'))->toBe('private')
        ->and(config('filesystems.disks.s3.throw'))->toBeTrue()
        ->and(config('filesystems.disks.s3'))->not->toHaveKey('url');
});

it('reads the s3 endpoint, region, bucket and path-style setting from env', function () {
    $disk = s3DiskConfigWith([
        'AWS_ENDPOINT' => 'https://example-ref.supabase.co/storage/v1/s3',
        'AWS_USE_PATH_STYLE_ENDPOINT' => 'true',
        'AWS_DEFAULT_REGION' => 'ap-southeast-1',
        'AWS_BUCKET' => 'digitalin-private',
    ]);

    expect($disk)->toMatchArray([
        'endpoint' => 'https://example-ref.supabase.co/storage/v1/s3',
        'use_path_style_endpoint' => true,
        'region' => 'ap-southeast-1',
        'bucket' => 'digitalin-private',
    ])
        // Supabase wajib path-style: default true bila env kosong, tetap bisa dimatikan lewat env.
        ->and(s3DiskConfigWith([])['use_path_style_endpoint'])->toBeTrue()
        ->and(s3DiskConfigWith(['AWS_USE_PATH_STYLE_ENDPOINT' => 'false'])['use_path_style_endpoint'])->toBeFalse();
});

it('never talks to the real Supabase Storage in tests (s3 disk is faked locally)', function () {
    expect(str_replace('\\', '/', Storage::disk('s3')->path('x')))->toContain('framework/testing/disks/s3');
});

it('stores KTM uploads on the configured sensitive disk and serves them only through the admin endpoint', function () {
    $student = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION']);
    $profile = StudentProfile::query()->create(['user_id' => $student->id, 'university_name_custom' => 'Kampus Uji']);

    $response = $this->withToken($student->createToken('t')->plainTextToken)->postJson('/api/v1/students/me/verification', [
        'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 isi-ktm-rahasia'),
    ])->assertAccepted();

    $path = $profile->fresh()->ktm_file_url;
    Storage::disk('s3')->assertExists($path);
    Storage::disk('private')->assertMissing($path);
    expect(json_encode($response->json()))->not->toContain($path)->not->toContain('http');

    // Pemilik akun sendiri pun tidak bisa mengunduh; hanya admin lewat endpoint berotorisasi.
    Auth::forgetGuards();
    $this->withToken($student->createToken('t2')->plainTextToken)->get("/api/v1/admin/students/{$profile->id}/ktm")->assertForbidden();

    $admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
    Auth::forgetGuards();
    $download = $this->withToken($admin->createToken('t')->plainTextToken)->get("/api/v1/admin/students/{$profile->id}/ktm")->assertOk();
    expect($download->streamedContent())->toBe('%PDF-1.4 isi-ktm-rahasia');
});

it('stores milestone submission files on the configured sensitive disk', function () {
    $this->seed(PlatformSettingsSeeder::class);
    Artisan::call('universities:import');
    Http::fake();
    Mail::fake();
    expect(Artisan::call('demo:seed'))->toBe(0);

    $file = SubmissionFile::query()->firstOrFail();
    Storage::disk('s3')->assertExists($file->file_url);
    Storage::disk('local')->assertMissing($file->file_url);
    Storage::disk('s3')->assertExists(StudentProfile::query()->whereNotNull('ktm_file_url')->value('ktm_file_url'));

    // demo:clear menghapus file dari disk yang sama.
    Artisan::call('demo:clear', ['--force' => true]);
    Storage::disk('s3')->assertMissing($file->file_url);
    expect(DemoAccounts::exist())->toBeFalse();
});
