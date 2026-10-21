<?php

use App\Models\AdminAlert;
use App\Models\Contract;
use App\Models\Escrow;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use App\Models\Wallet;
use App\Support\Demo\DemoAccounts;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Support\Facades\Artisan;
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
});

function seedDemo(): string
{
    expect(Artisan::call('demo:seed'))->toBe(0);
    $output = Artisan::output();
    preg_match('/dicetak sekali.*\R\s+(\S+)/u', $output, $match);

    return $match[1] ?? '';
}

function ledgerBalanced(): bool
{
    foreach (LedgerTransaction::query()->with('entries')->get() as $transaction) {
        if ($transaction->entries->where('direction', 'DEBIT')->sum('amount') !== $transaction->entries->where('direction', 'CREDIT')->sum('amount')) {
            return false;
        }
    }
    foreach (Wallet::query()->get() as $wallet) {
        $entries = LedgerEntry::query()->where('wallet_id', $wallet->id)->get();
        if ($wallet->balance !== $entries->where('direction', 'CREDIT')->sum('amount') - $entries->where('direction', 'DEBIT')->sum('amount')) {
            return false;
        }
    }

    return true;
}

it('seeds demo data with valid statuses through the application flows', function () {
    $password = seedDemo();

    expect(DemoAccounts::query()->where('role', 'UMKM')->count())->toBe(5)
        ->and(DemoAccounts::query()->where('role', 'STUDENT')->count())->toBe(10)
        ->and(User::query()->where('email', 'not like', '%@'.DemoAccounts::DOMAIN)->count())->toBe(0);

    $students = StudentProfile::query()->get();
    expect($students->where('verification_status', 'VERIFIED')->count())->toBe(6)
        ->and($students->where('verification_status', 'PENDING')->count())->toBe(3)
        ->and($students->where('verification_status', 'REJECTED')->count())->toBe(1)
        ->and($students->every(fn ($s) => $s->ktm_file_url && Storage::disk('private')->exists($s->ktm_file_url)))->toBeTrue()
        ->and($students->every(fn ($s) => $s->university_id !== null))->toBeTrue();

    expect(Project::query()->count())->toBe(8)
        ->and(Project::query()->pluck('status')->unique()->sort()->values()->all())->toContain('DRAFT', 'OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED');
    expect(Contract::query()->pluck('status')->countBy()->all())->toMatchArray(['IN_PROGRESS' => 4, 'COMPLETED' => 1, 'CANCELLED' => 1]);
    expect(Escrow::query()->pluck('status')->unique()->values()->all())->toContain('PARTIALLY_RELEASED', 'RELEASED', 'REFUNDED');

    $disputes = AdminAlert::query()->where('type', 'REVISION_LIMIT_DISPUTE')->get();
    expect($disputes)->toHaveCount(3)
        ->and(Milestone::query()->where('status', 'ESCALATED')->count())->toBe(2)
        ->and(AdminAlert::query()->whereIn('type', ['MENTOR_OVERDUE', 'UMKM_UNRESPONSIVE'])->count())->toBe(2);

    expect(ledgerBalanced())->toBeTrue()
        ->and(DB::table('personal_access_tokens')->where('name', 'demo-seed')->count())->toBe(0);

    // Password acak dicetak sekali dan bisa dipakai login.
    expect($password)->not->toBe('');
    $this->postJson('/api/v1/auth/login', ['identifier' => 'nadia.putri@'.DemoAccounts::DOMAIN, 'password' => $password])->assertOk();
});

it('refuses to run in production without --allow-production', function () {
    app()->detectEnvironment(fn () => 'production');

    expect(Artisan::call('demo:seed'))->toBe(1)
        ->and(Artisan::output())->toContain('--allow-production')
        ->and(DemoAccounts::exist())->toBeFalse();
});

it('refuses to seed twice', function () {
    seedDemo();

    expect(Artisan::call('demo:seed'))->toBe(1)
        ->and(Artisan::output())->toContain('demo:clear')
        ->and(DemoAccounts::query()->where('role', 'STUDENT')->count())->toBe(10);
});

it('clears only demo data and keeps real data and a balanced ledger', function () {
    // Data asli yang harus tetap utuh.
    $category = ServiceCategory::query()->create(['name' => 'Kategori Asli', 'slug' => 'kategori-asli']);
    $realUmkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE', 'email' => 'pemilik@usaha-asli.test']);
    $realProject = Project::query()->create([
        'umkm_id' => $realUmkm->id, 'category_id' => $category->id, 'title' => 'Proyek Asli', 'description' => 'Asli',
        'budget_min' => 100000, 'budget_max' => 200000, 'deadline' => now()->addMonth()->toDateString(), 'status' => 'DRAFT',
    ]);
    $systemBalancesBefore = Wallet::query()->whereNull('user_id')->pluck('balance', 'type')->all();

    seedDemo();
    $ktmPaths = StudentProfile::query()->pluck('ktm_file_url');

    expect(Artisan::call('demo:clear', ['--force' => true]))->toBe(0);

    expect(DemoAccounts::exist())->toBeFalse()
        ->and(Project::query()->pluck('id')->all())->toBe([$realProject->id])
        ->and(User::query()->pluck('id')->all())->toBe([$realUmkm->id])
        ->and(Contract::query()->count())->toBe(0)
        ->and(Escrow::query()->count())->toBe(0)
        ->and(AdminAlert::query()->count())->toBe(0)
        ->and(University::query()->count())->toBe(100)
        ->and(ServiceCategory::query()->where('slug', 'kategori-asli')->exists())->toBeTrue()
        ->and(ledgerBalanced())->toBeTrue();
    foreach ($ktmPaths as $path) {
        Storage::disk('private')->assertMissing($path);
    }
    foreach (Wallet::query()->whereNull('user_id')->get() as $wallet) {
        expect($wallet->balance)->toBe($systemBalancesBefore[$wallet->type] ?? 0);
    }

    // Bisa di-seed ulang setelah dibersihkan.
    seedDemo();
    expect(DemoAccounts::query()->count())->toBe(18);
});
