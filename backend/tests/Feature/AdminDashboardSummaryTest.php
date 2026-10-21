<?php

use App\Support\Demo\DemoAccounts;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->seed(PlatformSettingsSeeder::class);
    Artisan::call('universities:import');
    Storage::fake('private');
    Storage::fake('local');
    Http::fake();
    Mail::fake();
    Artisan::call('demo:seed');
});

it('summarises verifications, held funds and disputes from real data', function () {
    $token = DemoAccounts::query()->where('role', 'ADMIN')->firstOrFail()->createToken('t')->plainTextToken;

    $data = $this->withToken($token)->getJson('/api/v1/admin/dashboard/summary')->assertOk()->json('data');

    // Demo: 3 mahasiswa menunggu (KTM), 2 sengketa terbuka, 4 kontrak dengan dana tertahan.
    expect($data['pending_verifications'])->toBe(3)
        ->and($data['active_disputes'])->toBe(2)
        ->and($data['held_funds']['contracts'])->toBe(4)
        ->and($data['held_funds']['amount'])->toBe(
            DB::table('escrows')->whereIn('status', ['HELD', 'PARTIALLY_RELEASED'])->sum('held_amount'),
        )
        ->and(collect($data['recent_verifications'])->pluck('name')->sort()->values()->all())->toBe(['Bagas Wirawan', 'Kirana Ayu', 'Rangga Saputra'])
        ->and($data['recent_disputes'])->toHaveCount(3)
        ->and(collect($data['recent_disputes'])->pluck('project')->filter()->count())->toBe(3)
        ->and(json_encode($data))->not->toContain('email')->not->toContain('ktm_file_url');
});

it('is only available to admins', function () {
    $student = DemoAccounts::query()->where('role', 'STUDENT')->where('status', 'ACTIVE')->firstOrFail();
    $this->withToken($student->createToken('t')->plainTextToken)->getJson('/api/v1/admin/dashboard/summary')->assertForbidden();
    Auth::forgetGuards();
    $this->flushHeaders()->getJson('/api/v1/admin/dashboard/summary')->assertUnauthorized();
});
