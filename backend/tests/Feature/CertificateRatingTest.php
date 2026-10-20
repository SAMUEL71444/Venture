<?php

use App\Models\Certificate;
use App\Models\MentorProfile;
use App\Models\PortfolioItem;
use App\Models\Project;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use App\Models\University;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsContracts;
use Tests\TestCase;

/**
 * Fase 7 — sertifikat, portofolio terverifikasi, rating.
 * Acuan: 05-sequence-diagram.md bagian 3 (akhir), README aturan 19, 08 (Rating, Sertifikat).
 */
class CertificateRatingTest extends TestCase
{
    use BuildsContracts, RefreshDatabase;

    private $contract;

    private StudentProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpParties();

        $university = University::query()->create(['name' => 'Kampus Example', 'email_domain' => 'example.ac.id', 'city' => 'Bandung', 'is_partner' => true]);
        $this->profile = StudentProfile::query()->create(['user_id' => $this->student->id, 'university_id' => $university->id, 'verification_status' => 'VERIFIED']);
        UmkmProfile::query()->create(['user_id' => $this->umkm->id, 'business_name' => 'Warung Example']);

        // Milestone terakhir menunggu review UMKM.
        $this->contract = $this->makeContract('IN_PROGRESS', [[400000, 'CLIENT_REVIEW']]);
        $milestone = $this->milestoneOf($this->contract, 1);
        $this->assignMentor($milestone, $this->mentor, eligible: true);
        $submission = $this->makeSubmission($milestone, 'PENDING_CLIENT');

        $this->actingWith($this->umkm)->postJson("/api/v1/submissions/{$submission->id}/client-review", ['decision' => 'APPROVED'])->assertOk();
    }

    public function test_completing_contract_issues_certificate_and_verified_portfolio(): void
    {
        $this->assertSame('COMPLETED', $this->contract->fresh()->status);

        $certificate = Certificate::query()->sole();
        $this->assertSame($this->student->id, $certificate->student_id);
        $this->assertStringStartsWith('CERT-', $certificate->certificate_no);
        $this->assertSame(40, strlen($certificate->verification_code));

        $portfolio = PortfolioItem::query()->sole();
        $this->assertTrue($portfolio->is_verified);
        $this->assertSame($this->contract->id, $portfolio->contract_id);
        $this->assertSame(1, $this->profile->fresh()->completed_contracts_count);

        $this->assertSame(1, UserNotification::query()->where('user_id', $this->student->id)->where('type', 'CERTIFICATE_ISSUED')->count());
        $this->assertSame(2, UserNotification::query()->where('type', 'RATING_REQUESTED')->count());

        $this->actingWith($this->student)->getJson('/api/v1/students/me/certificates')->assertOk()->assertJsonCount(1, 'data');
        $this->actingWith($this->umkm)->getJson('/api/v1/students/me/certificates')->assertStatus(403);
    }

    public function test_certificate_can_be_verified_publicly_without_contact_data(): void
    {
        $certificate = Certificate::query()->sole();
        $this->app['auth']->forgetGuards();

        $response = $this->withHeaders(['Authorization' => ''])->getJson("/api/v1/certificates/{$certificate->verification_code}/verify")
            ->assertOk()
            ->assertJsonPath('data.valid', true)
            ->assertJsonPath('data.certificate_no', $certificate->certificate_no)
            ->assertJsonPath('data.student_name', $this->student->name)
            ->assertJsonPath('data.university', 'Kampus Example')
            ->assertJsonPath('data.project_title', 'Setup Instagram');
        $this->assertStringNotContainsString((string) $this->student->email, $response->getContent());

        $this->getJson('/api/v1/certificates/not-a-real-code/verify')->assertStatus(404);
    }

    public function test_rating_rules(): void
    {
        $url = "/api/v1/contracts/{$this->contract->id}/ratings";

        $this->actingWith($this->umkm)->postJson($url, ['target' => 'STUDENT', 'score' => 4, 'comment' => 'Rapi'])
            ->assertCreated()->assertJsonPath('data.direction', 'UMKM_TO_STUDENT');
        $this->actingWith($this->umkm)->postJson($url, ['target' => 'STUDENT', 'score' => 5])->assertStatus(422);
        // UMKM tidak menilai mentor.
        $this->actingWith($this->umkm)->postJson($url, ['target' => 'MENTOR', 'score' => 5])->assertStatus(422);

        $this->actingWith($this->student)->postJson($url, ['target' => 'UMKM', 'score' => 5])
            ->assertCreated()->assertJsonPath('data.direction', 'STUDENT_TO_UMKM');
        $this->actingWith($this->student)->postJson($url, ['target' => 'MENTOR', 'score' => 3])
            ->assertCreated()->assertJsonPath('data.ratee_id', $this->mentor->id);
        $this->actingWith($this->student)->postJson($url, ['target' => 'STUDENT', 'score' => 3])->assertStatus(422);
        $this->actingWith($this->student)->postJson($url, ['target' => 'UMKM', 'score' => 6])->assertStatus(422);

        $this->actingWith(User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']))->postJson($url, ['target' => 'STUDENT', 'score' => 1])->assertStatus(403);
        $this->actingWith($this->mentor)->postJson($url, ['target' => 'STUDENT', 'score' => 1])->assertStatus(403);

        $this->assertEquals(4.0, (float) $this->profile->fresh()->rating_avg);
        $this->assertEquals(5.0, (float) UmkmProfile::query()->where('user_id', $this->umkm->id)->value('rating_avg'));
        $this->assertEquals(3.0, (float) MentorProfile::query()->where('user_id', $this->mentor->id)->value('rating_avg'));
    }

    public function test_ratings_require_completed_contract(): void
    {
        $project = Project::query()->create([
            'umkm_id' => $this->umkm->id, 'category_id' => $this->project->category_id, 'title' => 'Lain', 'description' => 'x',
            'budget_min' => 1, 'budget_max' => 1, 'status' => 'ASSIGNED',
        ]);
        $this->project = $project;
        $running = $this->makeContract('IN_PROGRESS', [[400000, 'IN_PROGRESS']]);

        $this->actingWith($this->umkm)->postJson("/api/v1/contracts/{$running->id}/ratings", ['target' => 'STUDENT', 'score' => 4])->assertStatus(409);
    }
}
