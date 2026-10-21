<?php

use App\Models\Escrow;
use App\Models\User;
use App\Support\Demo\DemoAccounts;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

const ADMIN_ESCROW_KEYS = ['id', 'status', 'funded_amount', 'held_amount', 'released_amount', 'refunded_amount', 'contract', 'project', 'umkm', 'student', 'milestones', 'funded_at', 'updated_at'];

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

function escrows(string $token, string $query = '')
{
    Auth::forgetGuards();

    return test()->withToken($token)->getJson('/api/v1/admin/escrows'.$query);
}

it('is only available to admins', function () {
    $umkm = DemoAccounts::query()->where('role', 'UMKM')->firstOrFail();
    escrows($umkm->createToken('t')->plainTextToken)->assertForbidden();
});

it('lists escrow funds with parties, amounts and whitelisted fields', function () {
    $response = escrows($this->adminToken, '?per_page=50')->assertOk()->assertJsonPath('meta.total', 6);

    foreach ($response->json('data') as $row) {
        expect(array_keys($row))->toEqualCanonicalizing(ADMIN_ESCROW_KEYS)
            ->and($row['umkm']['name'])->not->toBeEmpty()
            ->and($row['student']['name'])->not->toBeEmpty()
            ->and($row['funded_amount'])->toBe($row['held_amount'] + $row['released_amount'] + $row['refunded_amount']);
    }
    expect(json_encode($response->json()))->not->toContain('gateway')->not->toContain('payment_id')->not->toContain('email');

    $byTitle = collect($response->json('data'))->keyBy('project.title');
    expect($byTitle['Rapikan Pembukuan 6 Bulan Terakhir']['status'])->toBe('RELEASED')
        ->and($byTitle['Konten TikTok Mingguan']['status'])->toBe('REFUNDED')
        ->and(collect($byTitle['Website Company Profile Sederhana']['milestones'])->where('can_release', true)->count())->toBe(1)
        ->and($byTitle['Website Company Profile Sederhana']['contract']['can_refund'])->toBeTrue()
        ->and($byTitle['Konten TikTok Mingguan']['contract']['can_refund'])->toBeFalse();
});

it('filters by fund status group', function () {
    $count = fn (string $status) => escrows($this->adminToken, "?status={$status}")->assertOk()->json('meta.total');

    expect($count('held'))->toBe(4)
        ->and($count('released'))->toBe(1)
        ->and($count('refunded'))->toBe(1);
    escrows($this->adminToken, '?status=frozen')->assertUnprocessable();
});

it('reflects release (force approve) and refund (terminate) done with the existing endpoints', function () {
    $website = collect(escrows($this->adminToken, '?per_page=50')->json('data'))->firstWhere('project.title', 'Website Company Profile Sederhana');
    $disputed = collect($website['milestones'])->firstWhere('can_release', true);

    Auth::forgetGuards();
    $this->withToken($this->adminToken)->postJson("/api/v1/admin/milestones/{$disputed['id']}/force-approve", ['notes' => 'Sesuai mockup tertulis.'])->assertOk();
    $after = Escrow::query()->findOrFail($website['id']);
    expect($after->released_amount)->toBe($website['released_amount'] + $disputed['amount'])
        ->and($after->held_amount)->toBe($website['held_amount'] - $disputed['amount']);

    $open = $after->contract->milestones()->whereNotIn('status', ['APPROVED', 'CANCELLED'])->get();
    Auth::forgetGuards();
    $this->withToken($this->adminToken)->postJson("/api/v1/admin/contracts/{$website['contract']['id']}/terminate", [
        'allocations' => $open->map(fn ($m) => ['milestone_id' => $m->id, 'amount_to_student' => 0, 'amount_to_umkm' => $m->amount])->all(),
        'admin_notes' => 'Kontrak dihentikan, sisa dana dikembalikan ke UMKM.',
    ])->assertCreated();

    $row = collect(escrows($this->adminToken, '?per_page=50')->json('data'))->firstWhere('id', $website['id']);
    expect($row['refunded_amount'])->toBe($open->sum('amount'))
        ->and($row['held_amount'])->toBe(0)
        ->and($row['contract']['can_refund'])->toBeFalse();
});
