<?php

use App\Models\Application;
use App\Models\Contract;
use App\Models\Escrow;
use App\Models\Invitation;
use App\Models\Milestone;
use App\Models\PlatformSetting;
use App\Models\Project;
use App\Models\ProjectTemplate;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\payment\Gateway\PaymentGateway;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fase 2 — Project + lamaran + kontrak + milestone.
 * Acuan: 03-erd.md bagian 2, 04-state-diagram.md bagian 1–2, 05-sequence-diagram.md bagian 1,
 * 08-api-endpoints.md (Project, Lamaran & Undangan, Kontrak), README Smart Matching.
 */
class ProjectPhaseTest extends TestCase
{
    use RefreshDatabase;

    private User $umkm;

    private User $student;

    private ServiceCategory $category;

    private University $university;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(PlatformSettingsSeeder::class);

        $this->category = ServiceCategory::query()->create(['name' => 'Kelola Sosmed', 'slug' => 'kelola-sosmed']);
        $this->university = University::query()->create([
            'name' => 'Kampus Example', 'email_domain' => 'example.ac.id', 'city' => 'Bandung', 'is_partner' => true,
        ]);
        $this->umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $this->student = $this->makeStudent();
    }

    // ---------------------------------------------------------------- project

    public function test_umkm_can_create_and_publish_project_with_recommendations(): void
    {
        $fullStudent = $this->makeStudent();
        $this->giveActiveContracts($fullStudent, 2);
        $this->makeStudent(verified: false);
        $this->makeStudent(skill: null);

        $projectId = $this->as($this->umkm)
            ->postJson('/api/v1/projects', $this->projectPayload())
            ->assertCreated()
            ->assertJsonPath('data.status', 'DRAFT')
            ->json('data.id');

        $response = $this->as($this->umkm)
            ->postJson("/api/v1/projects/{$projectId}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', 'OPEN')
            ->assertJsonCount(1, 'meta.recommendations')
            ->assertJsonPath('meta.recommendations.0.student_id', $this->student->id);

        // ADVANCED 35 + rating default 3,5 (17,5) + kota sama 15 + penyelesaian default 70% (10,5) + 0 kontrak aktif 10.
        $this->assertSame(88, $response->json('meta.recommendations.0.match_score'));
        $this->assertNotNull(Project::query()->find($projectId)->published_at);
    }

    public function test_recommendations_endpoint_is_owner_only(): void
    {
        $project = $this->makeProject();

        $this->as($this->umkm)->getJson("/api/v1/projects/{$project->id}/recommendations")->assertOk()->assertJsonCount(1, 'data');
        $this->as($this->otherUmkm())->getJson("/api/v1/projects/{$project->id}/recommendations")->assertStatus(403);
        $this->as($this->student)->getJson("/api/v1/projects/{$project->id}/recommendations")->assertStatus(403);
    }

    public function test_project_update_rules(): void
    {
        $project = $this->makeProject();

        $this->as($this->umkm)->putJson("/api/v1/projects/{$project->id}", ['title' => 'Judul baru'])
            ->assertOk()->assertJsonPath('data.title', 'Judul baru');
        $this->as($this->otherUmkm())->putJson("/api/v1/projects/{$project->id}", ['title' => 'x'])->assertStatus(403);
        $this->as($this->umkm)->putJson("/api/v1/projects/{$project->id}", ['budget_max' => 1])
            ->assertStatus(422)->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');
        $this->as($this->umkm)->putJson("/api/v1/projects/{$project->id}", ['deadline' => now()->subDay()->toDateString()])
            ->assertStatus(422)->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $project->update(['status' => 'ASSIGNED']);
        $this->as($this->umkm)->putJson("/api/v1/projects/{$project->id}", ['title' => 'x'])->assertStatus(409);
    }

    public function test_invalid_project_transitions_are_rejected_with_409(): void
    {
        $project = $this->makeProject(['status' => 'CANCELLED']);

        $this->as($this->umkm)->postJson("/api/v1/projects/{$project->id}/publish")
            ->assertStatus(409)->assertJsonPath('error.code', 'INVALID_STATE_TRANSITION');
        $this->as($this->umkm)->postJson("/api/v1/projects/{$project->id}/cancel")->assertStatus(409);
    }

    public function test_cancel_closes_open_applications_and_invitations(): void
    {
        $project = $this->makeProject();
        $applicationId = $this->apply($project)->assertCreated()->json('data.id');
        $invitee = $this->makeStudent();
        $invitationId = $this->as($this->umkm)
            ->postJson("/api/v1/projects/{$project->id}/invitations", ['student_id' => $invitee->id])
            ->assertCreated()->json('data.id');

        $this->as($this->umkm)->postJson("/api/v1/projects/{$project->id}/cancel")
            ->assertOk()->assertJsonPath('data.status', 'CANCELLED');

        $this->assertSame('REJECTED', Application::query()->find($applicationId)->status);
        $this->assertSame('EXPIRED', Invitation::query()->find($invitationId)->status);
    }

    public function test_project_visibility(): void
    {
        $draft = $this->makeProject(['status' => 'DRAFT']);
        $open = $this->makeProject();
        $this->apply($open)->assertCreated();

        $this->as($this->student)->getJson("/api/v1/projects/{$draft->id}")->assertStatus(404);
        $this->as($this->student)->getJson("/api/v1/projects/{$open->id}")
            ->assertOk()
            ->assertJsonMissingPath('data.applications')
            ->assertJsonPath('data.my_application.status', 'PENDING');
        $this->as($this->umkm)->getJson("/api/v1/projects/{$draft->id}")->assertOk();

        $this->as($this->student)->getJson('/api/v1/projects')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $open->id);
        $this->as($this->umkm)->getJson('/api/v1/projects?mine=1')->assertOk()->assertJsonCount(2, 'data');

        // Daftar pelamar hanya untuk pemilik.
        $this->as($this->umkm)->getJson("/api/v1/projects/{$open->id}/applications")->assertOk()->assertJsonCount(1, 'data');
        $this->as($this->otherUmkm())->getJson("/api/v1/projects/{$open->id}/applications")->assertStatus(403);
    }

    public function test_templates_are_public(): void
    {
        $this->makeTemplate();

        $this->getJson("/api/v1/templates?category_id={$this->category->id}")
            ->assertOk()->assertJsonCount(1, 'data');
    }

    // ---------------------------------------------------------------- lamaran

    public function test_student_can_apply_and_match_score_is_stored(): void
    {
        $project = $this->makeProject();

        $this->apply($project)
            ->assertCreated()
            ->assertJsonPath('data.status', 'PENDING')
            ->assertJsonPath('data.match_score', 88)
            ->assertJsonPath('data.proposed_milestones.0.amount', 400000);
    }

    public function test_apply_business_rules_return_422(): void
    {
        $project = $this->makeProject();

        $this->apply($project, ['offered_price' => 999999])
            ->assertStatus(422)->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');

        $this->apply($project, ['offered_price' => 249999, 'proposed_milestones' => [
            $this->milestoneInput('Satu', 149999, 3),
            $this->milestoneInput('Dua', 100000, 6),
        ]])->assertStatus(422)->assertJsonPath('error.details.min_milestone_amount', 150000);

        $this->apply($project, ['proposed_milestones' => [
            $this->milestoneInput('Satu', 400000, 8),
            $this->milestoneInput('Dua', 600000, 3),
        ]])->assertStatus(422);

        $this->apply($project, [], $this->makeStudent(verified: false))->assertStatus(403); // akun PENDING_VERIFICATION

        $unverifiedProfile = $this->makeStudent();
        StudentProfile::query()->where('user_id', $unverifiedProfile->id)->update(['verification_status' => 'PENDING']);
        $this->apply($project, [], $unverifiedProfile)->assertStatus(422);

        $busy = $this->makeStudent();
        $this->giveActiveContracts($busy, 2);
        $this->apply($project, [], $busy)->assertStatus(422)->assertJsonPath('error.details.active_contracts', 2);

        $this->apply($project)->assertCreated();
        $this->apply($project)->assertStatus(422);
    }

    public function test_apply_on_non_open_project_is_409_and_wrong_role_is_403(): void
    {
        $this->apply($this->makeProject(['status' => 'DRAFT']))->assertStatus(409);

        $mentor = User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']);
        $this->as($mentor)->postJson('/api/v1/projects/'.$this->makeProject()->id.'/applications', $this->applicationPayload())
            ->assertStatus(403);
    }

    public function test_apply_without_milestones_uses_template_defaults(): void
    {
        $project = $this->makeProject(['template_id' => $this->makeTemplate()->id]);

        $response = $this->apply($project, ['offered_price' => 1000001, 'proposed_milestones' => null])->assertCreated();

        $milestones = $response->json('data.proposed_milestones');
        $this->assertCount(2, $milestones);
        $this->assertSame(400000, $milestones[0]['amount']);
        $this->assertSame(600001, $milestones[1]['amount']);
        $this->assertSame(now()->addDays(4)->toDateString(), $milestones[0]['due_date']);

        // Tanpa template, usulan milestone wajib.
        $this->apply($this->makeProject(), ['proposed_milestones' => null], $this->makeStudent())->assertStatus(422);
    }

    public function test_withdraw_and_reject(): void
    {
        $project = $this->makeProject();
        $applicationId = $this->apply($project)->json('data.id');

        $this->as($this->makeStudent())->postJson("/api/v1/applications/{$applicationId}/withdraw")->assertStatus(403);
        $this->as($this->student)->postJson("/api/v1/applications/{$applicationId}/withdraw")
            ->assertOk()->assertJsonPath('data.status', 'WITHDRAWN');
        $this->as($this->student)->postJson("/api/v1/applications/{$applicationId}/withdraw")->assertStatus(409);

        // Setelah menarik lamaran, mahasiswa boleh melamar ulang.
        $second = $this->apply($project)->assertCreated()->json('data.id');
        $this->as($this->otherUmkm())->postJson("/api/v1/applications/{$second}/reject")->assertStatus(403);
        $this->as($this->umkm)->postJson("/api/v1/applications/{$second}/reject")
            ->assertOk()->assertJsonPath('data.status', 'REJECTED');
        $this->as($this->umkm)->postJson("/api/v1/applications/{$second}/accept")->assertStatus(409);
    }

    // ---------------------------------------------------------------- kontrak

    public function test_accepting_application_creates_contract_milestones_and_escrow(): void
    {
        $project = $this->makeProject();
        $applicationId = $this->apply($project)->json('data.id');
        $otherApplicationId = $this->apply($project, [], $this->makeStudent())->json('data.id');

        $contract = $this->as($this->umkm)
            ->postJson("/api/v1/applications/{$applicationId}/accept")
            ->assertOk()
            ->assertJsonPath('data.contract.status', 'AWAITING_PAYMENT')
            ->assertJsonPath('data.contract.total_amount', 1000000)
            ->assertJsonCount(2, 'data.contract.milestones')
            ->assertJsonPath('data.contract.escrow.status', 'PENDING_FUNDING')
            ->json('data.contract');

        $model = Contract::query()->findOrFail($contract['id']);
        $this->assertSame('12.00', $model->platform_fee_pct);
        $this->assertSame('30.00', $model->mentor_share_pct);
        $this->assertSame(10000, $model->mentor_min_fee);
        $this->assertStringStartsWith('CTR-', $model->contract_no);
        $this->assertEqualsWithDelta(now()->addHours(24)->timestamp, $model->payment_due_at->timestamp, 5);

        $milestones = Milestone::query()->where('contract_id', $model->id)->orderBy('sequence')->get();
        $this->assertSame([1, 2], $milestones->pluck('sequence')->all());
        $this->assertSame([400000, 600000], $milestones->pluck('amount')->all());
        $this->assertSame(['LOCKED', 'LOCKED'], $milestones->pluck('status')->all());
        $this->assertSame([2, 2], $milestones->pluck('max_revisions')->all());
        $this->assertSame([3, 3], $milestones->pluck('max_mentor_returns')->all());

        $this->assertSame('ASSIGNED', $project->fresh()->status);
        $this->assertSame('ACCEPTED', Application::query()->find($applicationId)->status);
        $this->assertSame('REJECTED', Application::query()->find($otherApplicationId)->status);
        $this->assertSame(1, Escrow::query()->where('contract_id', $model->id)->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'CONTRACT_CREATED', 'entity_id' => $model->id]);

        // Fee snapshot tidak berubah walau setting diubah setelahnya.
        PlatformSetting::query()->whereKey('platform_fee_pct')->update(['value' => json_encode(15)]);
        $this->assertSame('12.00', $model->fresh()->platform_fee_pct);
    }

    public function test_accept_rechecks_active_contract_limit_with_409(): void
    {
        $project = $this->makeProject();
        $applicationId = $this->apply($project)->json('data.id');

        // Mahasiswa diterima di dua project lain setelah melamar.
        $this->giveActiveContracts($this->student, 2);

        $this->as($this->umkm)->postJson("/api/v1/applications/{$applicationId}/accept")
            ->assertStatus(409)->assertJsonPath('error.details.active_contracts', 2);

        $this->assertSame('PENDING', Application::query()->find($applicationId)->status);
        $this->assertSame('OPEN', $project->fresh()->status);
        $this->assertSame(0, Contract::query()->where('project_id', $project->id)->count());
    }

    public function test_accept_authorization_and_invalid_transitions(): void
    {
        $project = $this->makeProject();
        $applicationId = $this->apply($project)->json('data.id');
        $secondId = $this->apply($project, [], $this->makeStudent())->json('data.id');

        $this->as($this->otherUmkm())->postJson("/api/v1/applications/{$applicationId}/accept")->assertStatus(403);
        $this->as($this->student)->postJson("/api/v1/applications/{$applicationId}/accept")->assertStatus(403);

        $this->as($this->umkm)->postJson("/api/v1/applications/{$applicationId}/accept")->assertOk();
        // Double click & lamaran lain setelah project ASSIGNED.
        $this->as($this->umkm)->postJson("/api/v1/applications/{$applicationId}/accept")->assertStatus(409);
        $this->as($this->umkm)->postJson("/api/v1/applications/{$secondId}/accept")->assertStatus(409);
        $this->assertSame(1, Contract::query()->where('project_id', $project->id)->count());
    }

    public function test_database_allows_only_one_active_contract_per_project(): void
    {
        $project = $this->makeProject(['status' => 'ASSIGNED']);
        $this->makeContract($project, $this->student, 'IN_PROGRESS');
        $this->makeContract($project, $this->makeStudent(), 'CANCELLED');

        $this->expectException(QueryException::class);
        $this->makeContract($project, $this->makeStudent(), 'AWAITING_PAYMENT');
    }

    public function test_contract_listing_and_detail_access(): void
    {
        $project = $this->makeProject();
        $applicationId = $this->apply($project)->json('data.id');
        $contractId = $this->as($this->umkm)->postJson("/api/v1/applications/{$applicationId}/accept")->json('data.contract.id');

        $this->as($this->umkm)->getJson('/api/v1/contracts')->assertOk()->assertJsonCount(1, 'data');
        $this->as($this->student)->getJson('/api/v1/contracts')->assertOk()->assertJsonCount(1, 'data');
        $this->as($this->makeStudent())->getJson('/api/v1/contracts')->assertOk()->assertJsonCount(0, 'data');

        $this->as($this->student)->getJson("/api/v1/contracts/{$contractId}")
            ->assertOk()->assertJsonCount(2, 'data.milestones')->assertJsonPath('data.escrow.status', 'PENDING_FUNDING');
        $this->as($this->otherUmkm())->getJson("/api/v1/contracts/{$contractId}")->assertStatus(403);
        $this->as(User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']))
            ->getJson("/api/v1/contracts/{$contractId}")->assertStatus(403);
        $this->as(User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']))
            ->getJson("/api/v1/contracts/{$contractId}")->assertOk();
    }

    public function test_end_to_end_accept_payment_webhook_and_start_work(): void
    {
        $project = $this->makeProject();
        $applicationId = $this->apply($project)->json('data.id');
        $contractId = $this->as($this->umkm)->postJson("/api/v1/applications/{$applicationId}/accept")->json('data.contract.id');

        $this->as($this->student)->postJson("/api/v1/contracts/{$contractId}/start")->assertStatus(409);

        $payment = $this->as($this->umkm)
            ->postJson("/api/v1/contracts/{$contractId}/payments", ['method' => 'VA'])
            ->assertCreated()->json('data');

        $raw = json_encode(['gateway_ref' => $payment['gateway_ref'], 'status' => 'PAID', 'gross_amount' => $payment['total_charged']]);
        $this->call('POST', '/api/v1/webhooks/payment-gateway', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_SIGNATURE' => app(PaymentGateway::class)->sign($raw),
        ], $raw)->assertOk()->assertJsonPath('data.status', 'PAID');
        $this->assertSame('FUNDED', Contract::query()->find($contractId)->status);

        $this->as($this->student)->postJson("/api/v1/contracts/{$contractId}/start")
            ->assertOk()
            ->assertJsonPath('data.status', 'IN_PROGRESS')
            ->assertJsonPath('data.milestones.0.status', 'IN_PROGRESS')
            ->assertJsonPath('data.milestones.1.status', 'LOCKED');
    }

    // ---------------------------------------------------------------- undangan

    public function test_invitation_flow_links_application(): void
    {
        $project = $this->makeProject();

        $invitation = $this->as($this->umkm)
            ->postJson("/api/v1/projects/{$project->id}/invitations", ['student_id' => $this->student->id, 'message' => 'Halo'])
            ->assertCreated()->assertJsonPath('data.status', 'PENDING')->json('data');
        $this->assertEqualsWithDelta(now()->addDays(3)->timestamp, strtotime($invitation['expires_at']), 5);

        $this->as($this->umkm)->postJson("/api/v1/projects/{$project->id}/invitations", ['student_id' => $this->student->id])
            ->assertStatus(422);

        $this->as($this->makeStudent())->postJson("/api/v1/invitations/{$invitation['id']}/accept")->assertStatus(403);
        $this->as($this->student)->postJson("/api/v1/invitations/{$invitation['id']}/accept")
            ->assertOk()->assertJsonPath('data.status', 'ACCEPTED');
        $this->as($this->student)->postJson("/api/v1/invitations/{$invitation['id']}/decline")->assertStatus(409);

        $this->apply($project)->assertCreated()->assertJsonPath('data.invitation_id', $invitation['id']);
    }

    public function test_invitation_rules(): void
    {
        $project = $this->makeProject();
        $other = $this->as($this->otherUmkm());
        $other->postJson("/api/v1/projects/{$project->id}/invitations", ['student_id' => $this->student->id])->assertStatus(403);

        // Hanya mahasiswa terverifikasi yang bisa diundang.
        $this->as($this->umkm)->postJson("/api/v1/projects/{$project->id}/invitations", ['student_id' => $this->umkm->id])->assertStatus(422);
        $this->as($this->umkm)->postJson("/api/v1/projects/{$project->id}/invitations", ['student_id' => $this->makeStudent(verified: false)->id])->assertStatus(422);

        // Undangan kedaluwarsa -> 409 dan status EXPIRED.
        $expired = Invitation::query()->create([
            'project_id' => $project->id, 'student_id' => $this->student->id, 'status' => 'PENDING', 'expires_at' => now()->subMinute(),
        ]);
        $this->as($this->student)->postJson("/api/v1/invitations/{$expired->id}/accept")->assertStatus(409);
        $this->assertSame('EXPIRED', $expired->fresh()->status);

        // Mahasiswa dengan 2 kontrak aktif tidak bisa menerima undangan.
        $busy = $this->makeStudent();
        $this->giveActiveContracts($busy, 2);
        $busyInvitation = $this->as($this->umkm)->postJson("/api/v1/projects/{$project->id}/invitations", ['student_id' => $busy->id])->json('data.id');
        $this->as($busy)->postJson("/api/v1/invitations/{$busyInvitation}/accept")->assertStatus(422);
        $this->as($busy)->postJson("/api/v1/invitations/{$busyInvitation}/decline")->assertOk()->assertJsonPath('data.status', 'DECLINED');

        // Undangan untuk project yang tidak OPEN.
        $this->as($this->umkm)->postJson('/api/v1/projects/'.$this->makeProject(['status' => 'DRAFT'])->id.'/invitations', ['student_id' => $this->student->id])
            ->assertStatus(409);
    }

    // ---------------------------------------------------------------- helper

    private function as(User $user): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('test')->plainTextToken);
    }

    private function apply(Project $project, array $overrides = [], ?User $student = null)
    {
        return $this->as($student ?? $this->student)
            ->postJson("/api/v1/projects/{$project->id}/applications", array_replace($this->applicationPayload(), $overrides));
    }

    private function applicationPayload(): array
    {
        return [
            'proposal' => 'Saya siap mengelola Instagram bisnis Anda.',
            'offered_price' => 1000000,
            'estimated_days' => 10,
            'proposed_milestones' => [
                $this->milestoneInput('Riset & konsep', 400000, 4),
                $this->milestoneInput('Eksekusi feed', 600000, 10),
            ],
        ];
    }

    private function milestoneInput(string $title, int $amount, int $dueInDays): array
    {
        return ['title' => $title, 'amount' => $amount, 'due_date' => now()->addDays($dueInDays)->toDateString()];
    }

    private function projectPayload(): array
    {
        return [
            'category_id' => $this->category->id,
            'title' => 'Setup Instagram bisnis',
            'description' => 'Butuh feed dan bio Instagram.',
            'budget_min' => 500000,
            'budget_max' => 1500000,
            'deadline' => now()->addDays(30)->toDateString(),
            'city' => 'Bandung',
        ];
    }

    private function makeProject(array $overrides = []): Project
    {
        return Project::query()->create(array_replace([
            ...$this->projectPayload(),
            'umkm_id' => $this->umkm->id,
            'status' => 'OPEN',
            'published_at' => now(),
        ], $overrides));
    }

    private function makeTemplate(): ProjectTemplate
    {
        return ProjectTemplate::query()->create([
            'category_id' => $this->category->id,
            'title' => 'Paket Setup Instagram Bisnis',
            'default_milestones' => [
                ['title' => 'Riset & konsep', 'percentage' => 40],
                ['title' => 'Eksekusi feed', 'percentage' => 60],
            ],
            'suggested_budget_min' => 500000,
            'suggested_budget_max' => 1500000,
            'suggested_duration_days' => 10,
        ]);
    }

    private function makeStudent(bool $verified = true, ?string $skill = 'ADVANCED'): User
    {
        $student = User::factory()->create(['role' => 'STUDENT', 'status' => $verified ? 'ACTIVE' : 'PENDING_VERIFICATION']);
        $profile = StudentProfile::query()->create([
            'user_id' => $student->id,
            'university_id' => $this->university->id,
            'verification_status' => $verified ? 'VERIFIED' : 'PENDING',
            'is_available' => true,
        ]);

        if ($skill) {
            $profile->skills()->attach($this->category->id, ['level' => $skill]);
        }

        return $student;
    }

    private function giveActiveContracts(User $student, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->makeContract($this->makeProject(['status' => 'ASSIGNED']), $student, 'IN_PROGRESS');
        }
    }

    private function makeContract(Project $project, User $student, string $status): Contract
    {
        return Contract::query()->create([
            'project_id' => $project->id,
            'umkm_id' => $project->umkm_id,
            'student_id' => $student->id,
            'total_amount' => 1000000,
            'status' => $status,
        ]);
    }

    private function otherUmkm(): User
    {
        return User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
    }
}
