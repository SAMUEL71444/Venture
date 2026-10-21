<?php

use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\User;

// Pencarian dengan LIKE harus berperilaku sama di SQLite dan PostgreSQL:
// tanpa beda huruf besar/kecil, dan % _ \ dari input diperlakukan sebagai teks biasa.
it('searches project titles case-insensitively and treats % _ \\ literally', function () {
    $umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
    $category = ServiceCategory::query()->create(['name' => 'Branding', 'slug' => 'branding']);
    foreach (['Diskon 100% Kopi Susu', 'Diskon 1000 Kopi', 'Logo_Baru Kedai', 'LogoXBaru Kedai', 'Folder C:\\Desain'] as $title) {
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
        ->and($titles('c:\\desain'))->toBe(['Folder C:\\Desain']);
});
