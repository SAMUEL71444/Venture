<?php

use App\Models\PortfolioItem;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class ProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_can_update_own_profile_skills_and_portfolio(): void
    {
        $university = University::query()->create([
            'name' => 'Kampus Example',
            'email_domain' => 'example.ac.id',
            'city' => 'Bandung',
        ]);
        $studentUser = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $student = StudentProfile::query()->create([
            'user_id' => $studentUser->id,
            'university_id' => $university->id,
            'verification_status' => 'VERIFIED',
        ]);
        $category = ServiceCategory::query()->create(['name' => 'Desain Menu', 'slug' => 'desain-menu']);
        $token = $studentUser->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/v1/me/profile')
            ->assertOk()
            ->assertJsonPath('data.user.id', $studentUser->id)
            ->assertJsonPath('data.profile.id', $student->id);

        $this->putJson('/api/v1/me/profile', [
            'name' => 'Nadia Putri',
            'major' => 'Desain Komunikasi Visual',
            'semester' => 5,
        ])->assertOk()
            ->assertJsonPath('data.user.name', 'Nadia Putri')
            ->assertJsonPath('data.profile.major', 'Desain Komunikasi Visual');

        $this->putJson('/api/v1/students/me/skills', [
            'skills' => [['category_id' => $category->id, 'level' => 'ADVANCED']],
        ])->assertOk()
            ->assertJsonPath('data.skills.0.pivot.level', 'ADVANCED');

        $this->postJson('/api/v1/students/me/portfolio', [
            'title' => 'Menu Kedai',
            'description' => 'Desain menu digital.',
            'media_urls' => ['https://example.test/menu.png'],
        ])->assertCreated()
            ->assertJsonPath('data.is_verified', false);

        expect(PortfolioItem::query()->where('student_id', $student->id)->count())->toBe(1);
    }

    public function test_umkm_can_only_browse_verified_students(): void
    {
        $university = University::query()->create([
            'name' => 'Kampus Example',
            'email_domain' => 'example.ac.id',
            'city' => 'Bandung',
        ]);
        $verifiedUser = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $verified = StudentProfile::query()->create([
            'user_id' => $verifiedUser->id,
            'university_id' => $university->id,
            'verification_status' => 'VERIFIED',
            'rating_avg' => 4.5,
        ]);
        $pendingUser = User::factory()->create(['role' => 'STUDENT', 'status' => 'PENDING_VERIFICATION']);
        StudentProfile::query()->create([
            'user_id' => $pendingUser->id,
            'university_id' => $university->id,
            'verification_status' => 'PENDING',
        ]);
        $umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $token = $umkm->createToken('test')->plainTextToken;

        $response = $this->withToken($token)->getJson('/api/v1/students?city=Bandung');

        $response->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $verified->id);

        Auth::forgetGuards();
        $studentToken = $verifiedUser->createToken('test')->plainTextToken;
        $this->withToken($studentToken)->getJson('/api/v1/students')->assertForbidden();

        $this->withToken($studentToken)->getJson('/api/v1/students/'.$verified->id)
            ->assertOk()
            ->assertJsonPath('data.id', $verified->id);
    }
}
