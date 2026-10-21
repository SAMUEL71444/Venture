<?php

use App\Models\AdminAlert;
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
    $this->adminToken = DemoAccounts::query()->where('role', 'ADMIN')->firstOrFail()->createToken('t')->plainTextToken;
});

function disputes(string $token, string $uri = '')
{
    Auth::forgetGuards();

    return test()->withToken($token)->getJson('/api/v1/admin/disputes'.$uri);
}

it('is only available to admins', function () {
    disputes(DemoAccounts::query()->where('role', 'STUDENT')->firstOrFail()->createToken('t')->plainTextToken)->assertForbidden();
});

it('lists disputes with reason, parties and status filter', function () {
    $all = disputes($this->adminToken)->assertOk()->assertJsonPath('meta.total', 3)->json('data');
    $byProject = collect($all)->keyBy('project.title');

    expect($byProject['Pendaftaran & Optimasi Toko Shopee']['reason'])->toBe('Hasil revisi judul & foto produk belum sesuai permintaan.')
        ->and($byProject['Pendaftaran & Optimasi Toko Shopee']['requester_role'])->toBe('UMKM')
        ->and($byProject['Pendaftaran & Optimasi Toko Shopee']['umkm']['name'])->toBe('Snack Kriuk Ibu Tini')
        ->and($byProject['Pendaftaran & Optimasi Toko Shopee']['student']['name'])->toBe('Nadia Putri')
        ->and($byProject['Pendaftaran & Optimasi Toko Shopee']['milestone']['can_decide'])->toBeTrue()
        ->and($byProject['Pembuatan Logo & Panduan Merek']['status'])->toBe('RESOLVED')
        ->and($byProject['Pembuatan Logo & Panduan Merek']['milestone']['can_decide'])->toBeFalse();

    expect(disputes($this->adminToken, '?status=open')->json('meta.total'))->toBe(2)
        ->and(disputes($this->adminToken, '?status=resolved')->json('meta.total'))->toBe(1);
    expect(json_encode($all))->not->toContain('email')->not->toContain('file_url');
});

it('shows dispute detail with submission and review history', function () {
    $alert = AdminAlert::query()->where('type', 'REVISION_LIMIT_DISPUTE')->where('status', '!=', 'RESOLVED')->firstOrFail();

    $detail = disputes($this->adminToken, "/{$alert->id}")->assertOk()->json('data');

    expect($detail['history'])->toHaveCount(3)
        ->and(collect($detail['history'][0]['reviews'])->pluck('decision')->all())->toContain('REVISION_REQUESTED')
        ->and($detail['history'][0]['files'])->not->toBeEmpty()
        ->and(json_encode($detail))->not->toContain('file_url');

    $other = AdminAlert::query()->where('type', '!=', 'REVISION_LIMIT_DISPUTE')->firstOrFail();
    disputes($this->adminToken, "/{$other->id}")->assertNotFound();
});

it('resolves a dispute through the existing return-to-student decision', function () {
    $alert = AdminAlert::query()->where('type', 'REVISION_LIMIT_DISPUTE')->where('status', '!=', 'RESOLVED')->firstOrFail();

    Auth::forgetGuards();
    $this->withToken($this->adminToken)->postJson("/api/v1/admin/milestones/{$alert->reference_id}/return-to-student", ['notes' => 'Perbaiki sesuai brief tertulis.'])->assertOk();

    $row = collect(disputes($this->adminToken)->json('data'))->firstWhere('id', $alert->id);
    expect($row['status'])->toBe('RESOLVED')
        ->and($row['milestone']['status'])->toBe('IN_PROGRESS')
        ->and($row['milestone']['can_decide'])->toBeFalse();
});
