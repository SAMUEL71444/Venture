<?php

use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Shared\Database\LikeSearch;

// Pencarian dengan LIKE harus berperilaku sama di SQLite dan PostgreSQL:
// tanpa beda huruf besar/kecil, dan % _ \ dari input diperlakukan sebagai teks biasa.
it('searches project titles case-insensitively and treats % _ \\ literally', function () {
    $umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
    $category = ServiceCategory::query()->create(['name' => 'Branding', 'slug' => 'branding']);
    foreach (['Diskon 100% Kopi Susu', 'Diskon 1000 Kopi', 'Logo_Baru Kedai', 'LogoXBaru Kedai', 'Folder C:\\Desain', 'Promo!% Hari Ini', 'Promo! Hari Ini'] as $title) {
        Project::query()->create([
            'umkm_id' => $umkm->id, 'category_id' => $category->id, 'title' => $title, 'description' => 'x',
            'budget_min' => 1, 'budget_max' => 1, 'deadline' => now()->addMonth()->toDateString(), 'status' => 'OPEN', 'published_at' => now(),
        ]);
    }
    $token = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE'])->createToken('t')->plainTextToken;
    $titles = fn (string $q) => collect($this->withToken($token)->getJson('/api/v1/projects?q='.rawurlencode($q))->assertOk()->json('data'))->pluck('title')->all();

    expect($titles('100%'))->toBe(['Diskon 100% Kopi Susu'])
        ->and($titles('logo_baru'))->toBe(['Logo_Baru Kedai'])
        ->and($titles('KOPI'))->toHaveCount(2)
        ->and($titles('c:\\desain'))->toBe(['Folder C:\\Desain'])
        // '!' adalah karakter escape LIKE; dari input harus tetap teks biasa.
        ->and($titles('promo!%'))->toBe(['Promo!% Hari Ini'])
        ->and($titles('promo!'))->toHaveCount(2);
});

it('searches admin users with % _ \\ ! treated literally', function () {
    foreach (['Toko 100% Halal', 'Toko 1000 Halal', 'Budi_Santoso', 'BudiXSantoso', 'Rina\\Dewi', 'Wow!_Kopi', 'Wow!XKopi'] as $i => $name) {
        User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE', 'name' => $name, 'email' => "u{$i}@usaha.test", 'phone' => '+62812000000'.$i]);
    }
    $token = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE', 'name' => 'Admin'])->createToken('t')->plainTextToken;
    $names = fn (string $q) => collect($this->withToken($token)->getJson('/api/v1/admin/users?per_page=50&q='.rawurlencode($q))->assertOk()->json('data'))
        ->pluck('name')->sort()->values()->all();

    expect($names('100%'))->toBe(['Toko 100% Halal'])
        ->and($names('budi_'))->toBe(['Budi_Santoso'])
        ->and($names('rina\\'))->toBe(['Rina\\Dewi'])
        ->and($names('wow!_'))->toBe(['Wow!_Kopi'])
        ->and($names('WOW!'))->toBe(['Wow!XKopi', 'Wow!_Kopi'])
        ->and($names('+628120000003'))->toBe(['BudiXSantoso']);
});

it('never puts a backslash literal in the LIKE SQL (breaks PDO pgsql placeholders)', function () {
    expect(LikeSearch::sql('name'))->toBe("LOWER(name) LIKE ? ESCAPE '!'")->not->toContain('\\')
        ->and(LikeSearch::containsPattern('A!b%c_d\\'))->toBe('%a!!b!%c!_d\\%');
});
