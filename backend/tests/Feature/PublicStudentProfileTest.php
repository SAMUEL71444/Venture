<?php

use App\Models\PortfolioItem;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;

const PUBLIC_STUDENT_KEYS = [
    'id', 'name', 'photo_url', 'university', 'university_name_custom', 'city', 'skills',
    'portfolio_count', 'portfolio', 'rating_avg', 'completed_contracts_count', 'is_verified',
];
const PUBLIC_STUDENT_FORBIDDEN = [
    'email', 'phone', 'campus_email', 'campus_email_verified_at', 'ktm_file_url', 'has_ktm', 'verified_by',
    'verification_rejection_reason', 'user_id', 'student_id', 'contract_id', 'media_urls', 'pivot', 'password_hash',
    'remember_token', 'nim', 'created_at', 'updated_at', 'email_domain', 'is_partner',
];

function publicStudentKeysDeep(array $payload): array
{
    $keys = [];
    foreach ($payload as $key => $value) {
        $keys[] = $key;
        if (is_array($value)) {
            $keys = [...$keys, ...publicStudentKeysDeep($value)];
        }
    }

    return $keys;
}

function verifiedStudent(array $profile = []): StudentProfile
{
    $user = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE', 'email' => fake()->unique()->safeEmail(), 'phone' => fake()->unique()->e164PhoneNumber()]);
    $student = StudentProfile::query()->create([
        'user_id' => $user->id, 'verification_status' => 'VERIFIED', 'campus_email' => fake()->unique()->userName().'@kampus.ac.id',
        'nim' => '123456', 'ktm_file_url' => 'verification/ktm/secret.pdf', 'rating_avg' => 4.5, ...$profile,
    ]);
    $category = ServiceCategory::query()->firstOrCreate(['slug' => 'desain-logo'], ['name' => 'Desain Logo']);
    $student->skills()->attach($category->id, ['level' => 'ADVANCED']);
    PortfolioItem::query()->create([
        'student_id' => $student->id, 'title' => 'Logo Kopi Senja', 'description' => str_repeat('Desain identitas. ', 20),
        'media_urls' => ['https://cdn.example/secret-path.png'],
    ]);

    return $student;
}

function umkmToken(): string
{
    return User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE'])->createToken('t')->plainTextToken;
}

it('sends only public fields from GET /students/{id}', function () {
    $university = University::query()->create(['name' => 'Institut Teknologi Bandung', 'email_domain' => 'itb.ac.id', 'city' => 'Bandung', 'is_partner' => true]);
    $student = verifiedStudent(['university_id' => $university->id]);

    $data = $this->withToken(umkmToken())->getJson("/api/v1/students/{$student->id}")
        ->assertOk()
        ->assertJsonPath('data.university.name', 'Institut Teknologi Bandung')
        ->assertJsonPath('data.city', 'Bandung')
        ->assertJsonPath('data.skills.0.name', 'Desain Logo')
        ->assertJsonPath('data.skills.0.level', 'ADVANCED')
        ->assertJsonPath('data.portfolio.0.title', 'Logo Kopi Senja')
        ->assertJsonPath('data.portfolio_count', 1)
        ->assertJsonPath('data.is_verified', true)
        ->json('data');

    expect(array_keys($data))->toEqualCanonicalizing(PUBLIC_STUDENT_KEYS)
        ->and(mb_strlen($data['portfolio'][0]['summary']))->toBeLessThanOrEqual(163)
        ->and(array_values(array_intersect(PUBLIC_STUDENT_FORBIDDEN, publicStudentKeysDeep($data))))->toBe([])
        ->and(json_encode($data))->not->toContain('secret');
});

it('sends only public fields in the paginated GET /students list', function () {
    $university = University::query()->create(['name' => 'Universitas Indonesia', 'email_domain' => 'ui.ac.id', 'city' => 'Depok']);
    verifiedStudent(['university_id' => $university->id]);
    verifiedStudent(['university_name_custom' => 'Sekolah Tinggi Contoh']);

    $response = $this->withToken(umkmToken())->getJson('/api/v1/students')->assertOk()->assertJsonPath('meta.total', 2);

    foreach ($response->json('data') as $row) {
        expect(array_keys($row))->toEqualCanonicalizing(PUBLIC_STUDENT_KEYS)
            ->and(array_values(array_intersect(PUBLIC_STUDENT_FORBIDDEN, publicStudentKeysDeep($row))))->toBe([]);
    }
});

it('shows a typed (custom) university on the public profile', function () {
    $student = verifiedStudent(['university_name_custom' => 'Sekolah Tinggi Contoh Nusantara']);

    $this->withToken(umkmToken())->getJson("/api/v1/students/{$student->id}")
        ->assertOk()
        ->assertJsonPath('data.university', null)
        ->assertJsonPath('data.university_name_custom', 'Sekolah Tinggi Contoh Nusantara')
        ->assertJsonPath('data.city', null);
});
