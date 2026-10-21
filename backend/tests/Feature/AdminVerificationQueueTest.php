<?php

use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

afterEach(function () {
    putenv('TEST_ADMIN_PASSWORD');
});

it('creates an admin non-interactively without printing the password', function () {
    putenv('TEST_ADMIN_PASSWORD=Sangat-Rahasia-Sekali-123');

    $exit = Artisan::call('auth:create-admin', [
        '--name' => 'Admin Server', '--email' => 'ADMIN@digitalin.test', '--password-env' => 'TEST_ADMIN_PASSWORD',
    ]);

    expect($exit)->toBe(0)
        ->and(Artisan::output())->not->toContain('Sangat-Rahasia-Sekali-123');
    $admin = User::query()->where('email', 'admin@digitalin.test')->firstOrFail();
    expect($admin->role)->toBe('ADMIN')
        ->and($admin->status)->toBe('ACTIVE')
        ->and(Hash::check('Sangat-Rahasia-Sekali-123', $admin->password_hash))->toBeTrue();
});

it('fails without creating an admin when the password variable is empty or too short', function () {
    expect(Artisan::call('auth:create-admin', ['--name' => 'A', '--email' => 'a@digitalin.test', '--password-env' => 'TEST_ADMIN_PASSWORD']))->toBe(1);

    putenv('TEST_ADMIN_PASSWORD=pendek');
    expect(fn () => Artisan::call('auth:create-admin', ['--name' => 'A', '--email' => 'a@digitalin.test', '--password-env' => 'TEST_ADMIN_PASSWORD']))
        ->toThrow(Illuminate\Validation\ValidationException::class);

    expect(User::query()->where('role', 'ADMIN')->count())->toBe(0);
});

it('still supports the interactive mode', function () {
    $this->artisan('auth:create-admin')
        ->expectsQuestion('Admin name', 'Admin Interaktif')
        ->expectsQuestion('Admin email', 'interaktif@digitalin.test')
        ->expectsQuestion('Admin password', 'Sangat-Rahasia-Sekali-123')
        ->expectsQuestion('Confirm admin password', 'Sangat-Rahasia-Sekali-123')
        ->assertSuccessful();

    expect(User::query()->where('email', 'interaktif@digitalin.test')->value('role'))->toBe('ADMIN');
});

it('lists KTM submissions with university, method, submission date and attempt count', function () {
    Storage::fake('private');
    $university = University::query()->create(['name' => 'Universitas Indonesia', 'email_domain' => 'ui.ac.id']);
    $user = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION', 'name' => 'Rangga Saputra']);
    $student = StudentProfile::query()->create(['user_id' => $user->id, 'university_id' => $university->id]);
    $token = $user->createToken('t')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/students/me/verification', ['ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 a')])->assertAccepted();
    // Mengganti file selama masih menunggu review tidak menambah jumlah pengajuan.
    $this->withToken($token)->postJson('/api/v1/students/me/verification', ['ktm' => UploadedFile::fake()->createWithContent('ktm.pdf', '%PDF-1.4 b')])->assertAccepted();

    $admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
    Auth::forgetGuards();
    $row = collect($this->withToken($admin->createToken('t')->plainTextToken)->getJson('/api/v1/admin/verifications')->assertOk()->json('data'))
        ->firstWhere('id', $student->id);

    expect($row['user']['name'])->toBe('Rangga Saputra')
        ->and($row['university_name'])->toBe('Universitas Indonesia')
        ->and($row['method'])->toBe('KTM')
        ->and($row['attempts'])->toBe(1)
        ->and($row['submitted_at'])->not->toBeNull()
        ->and($row)->not->toHaveKey('ktm_file_url');
});
