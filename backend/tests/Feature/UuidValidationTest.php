<?php

use App\Models\MentorProfile;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use App\Models\University;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/*
 * Nilai bukan UUID tidak boleh sampai ke query 'exists': PostgreSQL menolaknya
 * (22P02 invalid input syntax for type uuid) → 500, bukan 422.
 * Laravel melewati exists/unique bila atribut sudah gagal aturan sebelumnya
 * (Validator::hasNotFailedPreviousRuleIfPresenceRule), jadi syaratnya: 'uuid' ditulis SEBELUM 'exists'.
 * SQLite tidak error, karena itu test ini memeriksa langsung bahwa nilai tersebut tidak pernah jadi binding query.
 */
const NOT_A_UUID = 'bukan-uuid-123';

/** Jalankan request dan kembalikan [response, query yang membawa NOT_A_UUID sebagai binding]. */
function requestCapturingQueries(Closure $send): array
{
    $leaked = [];
    DB::listen(function ($query) use (&$leaked) {
        if (in_array(NOT_A_UUID, $query->bindings, true)) {
            $leaked[] = $query->sql;
        }
    });

    return [$send(), $leaked];
}

function actingToken(string $role): array
{
    $user = User::factory()->create(['role' => $role, 'status' => 'ACTIVE']);

    return [$user, $user->createToken('t')->plainTextToken];
}

it('rejects a non-UUID university_id at student registration with 422', function () {
    [$response, $leaked] = requestCapturingQueries(fn () => $this->postJson('/api/v1/auth/register/student', [
        'name' => 'Nadia Putri', 'email' => 'nadia@example.test', 'password' => 'rahasia-panjang-1',
        'university_id' => NOT_A_UUID,
    ]));

    $response->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');
    expect($response->json('error.details'))->toHaveKey('university_id')
        ->and($leaked)->toBe([]);
});

it('rejects non-UUID category_id and template_id when creating a project with 422', function () {
    [, $token] = actingToken('UMKM');

    [$response, $leaked] = requestCapturingQueries(fn () => $this->withToken($token)->postJson('/api/v1/projects', [
        'category_id' => NOT_A_UUID, 'template_id' => NOT_A_UUID,
        'title' => 'Desain logo', 'description' => 'Logo kedai.', 'budget_min' => 100000, 'budget_max' => 200000,
    ]));

    $response->assertStatus(422);
    expect($response->json('error.details'))->toHaveKeys(['category_id', 'template_id'])
        ->and($leaked)->toBe([]);
});

it('still checks existence for a well-formed but unknown category UUID', function () {
    [, $token] = actingToken('UMKM');

    $response = $this->withToken($token)->postJson('/api/v1/projects', [
        'category_id' => '0192f3a1-0000-7000-8000-000000000000',
        'title' => 'Desain logo', 'description' => 'Logo kedai.', 'budget_min' => 100000, 'budget_max' => 200000,
    ]);

    $response->assertStatus(422);
    expect($response->json('error.details.category_id.0'))->toContain('invalid');
});

it('rejects a non-UUID skill category for students with 422', function () {
    [$student, $token] = actingToken('STUDENT');
    StudentProfile::query()->create(['user_id' => $student->id, 'university_id' => University::query()->create(['name' => 'Kampus'])->id, 'verification_status' => 'VERIFIED']);

    [$response, $leaked] = requestCapturingQueries(fn () => $this->withToken($token)->putJson('/api/v1/students/me/skills', [
        'skills' => [['category_id' => NOT_A_UUID, 'level' => 'ADVANCED']],
    ]));

    $response->assertStatus(422);
    expect($response->json('error.details'))->toHaveKey('skills.0.category_id')
        ->and($leaked)->toBe([]);
});

it('rejects a non-UUID category filter when browsing students with 422', function () {
    [$umkm, $token] = actingToken('UMKM');
    UmkmProfile::query()->create(['user_id' => $umkm->id, 'business_name' => 'Kopi Anteng']);

    [$response, $leaked] = requestCapturingQueries(fn () => $this->withToken($token)->getJson('/api/v1/students?category_id='.NOT_A_UUID));

    $response->assertStatus(422);
    expect($response->json('error.details'))->toHaveKey('category_id')
        ->and($leaked)->toBe([]);
});

it('rejects a non-UUID mentor expertise category with 422', function () {
    [$mentor, $token] = actingToken('MENTOR');
    MentorProfile::query()->create(['user_id' => $mentor->id, 'title' => 'Senior', 'institution' => 'Studio', 'verification_status' => 'VERIFIED']);
    $category = ServiceCategory::query()->create(['name' => 'Desain', 'slug' => 'desain']);

    [$response, $leaked] = requestCapturingQueries(fn () => $this->withToken($token)->putJson('/api/v1/me/profile', [
        'expertise_category_ids' => [$category->id, NOT_A_UUID],
    ]));

    $response->assertStatus(422);
    expect($response->json('error.details'))->toHaveKey('expertise_category_ids.1')
        ->and($leaked)->toBe([]);
});
