<?php

use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use App\Models\University;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

const ADMIN_USER_KEYS = ['id', 'name', 'role', 'status', 'email', 'phone', 'university', 'business_name', 'verification_status', 'registered_at'];

beforeEach(function () {
    $this->admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE', 'name' => 'Admin Satu', 'remember_token' => 'rahasia']);
    $this->adminToken = $this->admin->createToken('a')->plainTextToken;

    $this->nadia = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE', 'name' => 'Nadia Putri', 'email' => 'nadia@kampus.test', 'phone' => '+6281200000001', 'created_at' => now()->subDays(3)]);
    StudentProfile::query()->create(['user_id' => $this->nadia->id, 'university_id' => University::query()->create(['name' => 'Universitas Indonesia'])->id,
        'verification_status' => 'VERIFIED', 'ktm_file_url' => 'verification/ktm/rahasia.pdf', 'campus_email' => 'nadia@ui.ac.id']);
    $this->kopi = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE', 'name' => 'Kopi Anteng', 'email' => 'kopi@usaha.test', 'phone' => '+6281200000002', 'created_at' => now()->subDay()]);
    UmkmProfile::query()->create(['user_id' => $this->kopi->id, 'business_name' => 'Kopi Anteng']);
    $this->custom = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION', 'name' => 'Maria Wenda', 'created_at' => now()->subDays(5)]);
    StudentProfile::query()->create(['user_id' => $this->custom->id, 'university_name_custom' => 'Sekolah Tinggi Contoh']);
});

function adminGet(string $token, string $uri)
{
    Auth::forgetGuards();

    return test()->withToken($token)->getJson($uri);
}

it('is only available to admins', function () {
    foreach ([$this->nadia, $this->kopi] as $user) {
        adminGet($user->createToken('t')->plainTextToken, '/api/v1/admin/users')->assertForbidden();
        adminGet($user->createToken('t')->plainTextToken, "/api/v1/admin/users/{$this->nadia->id}")->assertForbidden();
    }
    Auth::forgetGuards();
    $this->flushHeaders()->getJson('/api/v1/admin/users')->assertUnauthorized();
});

it('lists users newest first with whitelisted fields and pagination', function () {
    $response = adminGet($this->adminToken, '/api/v1/admin/users?per_page=2')
        ->assertOk()
        ->assertJsonPath('meta.total', 4)
        ->assertJsonPath('meta.last_page', 2);

    expect(array_column($response->json('data'), 'name'))->toBe(['Admin Satu', 'Kopi Anteng']);
    foreach ($response->json('data') as $row) {
        expect(array_keys($row))->toEqualCanonicalizing(ADMIN_USER_KEYS);
    }

    $all = collect(adminGet($this->adminToken, '/api/v1/admin/users')->json('data'))->keyBy('name');
    expect($all['Nadia Putri']['university'])->toBe('Universitas Indonesia')
        ->and($all['Nadia Putri']['verification_status'])->toBe('VERIFIED')
        ->and($all['Maria Wenda']['university'])->toBe('Sekolah Tinggi Contoh')
        ->and($all['Kopi Anteng']['business_name'])->toBe('Kopi Anteng')
        ->and(json_encode($all))->not->toContain('rahasia')
        ->and(json_encode($all))->not->toContain('password')
        ->and(json_encode($all))->not->toContain('ui.ac.id');
});

it('searches by name, email or phone (case-insensitive) and filters by role and status', function () {
    $names = fn (string $query) => array_column(adminGet($this->adminToken, '/api/v1/admin/users?'.$query)->assertOk()->json('data'), 'name');

    expect($names('q=NADIA'))->toBe(['Nadia Putri'])
        ->and($names('q=usaha.test'))->toBe(['Kopi Anteng'])
        ->and($names('q=00002'))->toBe(['Kopi Anteng'])
        ->and($names('q=100%25'))->toBe([])
        ->and($names('role=STUDENT'))->toBe(['Nadia Putri', 'Maria Wenda'])
        ->and($names('role=STUDENT&status=PENDING_VERIFICATION'))->toBe(['Maria Wenda']);

    adminGet($this->adminToken, '/api/v1/admin/users?role=HACKER')->assertUnprocessable();
});

it('shows user detail with track record and suspension reason', function () {
    Auth::forgetGuards();
    $this->withToken($this->adminToken)->postJson("/api/v1/admin/users/{$this->kopi->id}/suspend", ['reason' => 'Transaksi di luar platform'])->assertOk();

    $detail = adminGet($this->adminToken, "/api/v1/admin/users/{$this->kopi->id}")
        ->assertOk()
        ->assertJsonPath('data.status', 'SUSPENDED')
        ->assertJsonPath('data.suspension.reason', 'Transaksi di luar platform')
        ->assertJsonPath('data.stats.projects', 0)
        ->json('data');

    expect(array_keys($detail))->toEqualCanonicalizing([...ADMIN_USER_KEYS, 'stats', 'suspension']);
});

it('does not let an admin suspend another admin or themselves', function () {
    $other = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);

    foreach ([$other, $this->admin] as $target) {
        Auth::forgetGuards();
        $this->withToken($this->adminToken)->postJson("/api/v1/admin/users/{$target->id}/suspend", ['reason' => 'x'])->assertUnprocessable();
        expect($target->fresh()->status)->toBe('ACTIVE');
    }
});
