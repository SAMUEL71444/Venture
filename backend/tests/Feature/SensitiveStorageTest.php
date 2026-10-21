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
    config(['filesystems.sensitive_disks.ktm' => 'r2', 'filesystems.sensitive_disks.submissions' => 'r2']);
    Storage::fake('r2');
    Storage::fake('private');
    Storage::fake('local');
});

it('configures R2 as a private S3-compatible disk', function () {
    expect(config('filesystems.disks.r2.driver'))->toBe('s3')
        ->and(config('filesystems.disks.r2.visibility'))->toBe('private')
        ->and(config('filesystems.disks.r2.use_path_style_endpoint'))->toBeTrue()
        ->and(config('filesystems.disks.r2'))->not->toHaveKey('url');
});

it('stores KTM uploads on the configured sensitive disk and serves them only through the admin endpoint', function () {
    $student = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION']);
    $profile = StudentProfile::query()->create(['user_id' => $student->id, 'university_name_custom' => 'Kampus Uji']);

    $response = $this->withToken($student->createToken('t')->plainTextToken)->postJson('/api/v1/students/me/verification', [
        'ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 isi-ktm-rahasia'),
    ])->assertAccepted();

    $path = $profile->fresh()->ktm_file_url;
    Storage::disk('r2')->assertExists($path);
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
    Storage::disk('r2')->assertExists($file->file_url);
    Storage::disk('local')->assertMissing($file->file_url);
    Storage::disk('r2')->assertExists(StudentProfile::query()->whereNotNull('ktm_file_url')->value('ktm_file_url'));

    // demo:clear menghapus file dari disk yang sama.
    Artisan::call('demo:clear', ['--force' => true]);
    Storage::disk('r2')->assertMissing($file->file_url);
    expect(DemoAccounts::exist())->toBeFalse();
});
