<?php

use App\Models\AdminAlert;
use App\Models\Contract;
use App\Models\Escrow;
use App\Models\MentorAssignment;
use App\Models\MentorProfile;
use App\Models\Milestone;
use App\Models\MilestoneSettlement;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\Submission;
use App\Models\University;
use App\Models\User;
use App\Models\Wallet;
use App\Modules\ledger\Services\LedgerService;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Fase 4 — Mentor review + batas revisi.
 * Acuan: 04-state-diagram.md bagian 3, 05-sequence-diagram.md bagian 3, 08-api-endpoints.md.
 */
class MilestoneReviewTest extends TestCase
{
    use RefreshDatabase;

    private User $umkm;

    private User $student;

    private User $mentor;

    private ServiceCategory $category;

    private Project $project;

    private Contract $contract;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        $this->seed(PlatformSettingsSeeder::class);

        $this->category = ServiceCategory::query()->create(['name' => 'Kelola Sosmed', 'slug' => 'kelola-sosmed']);
        $this->umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $this->student = $this->makeStudent();
        $this->mentor = $this->makeMentor(expertise: true);

        $this->project = Project::query()->create([
            'umkm_id' => $this->umkm->id,
            'category_id' => $this->category->id,
            'title' => 'Setup Instagram bisnis',
            'description' => 'Butuh feed dan bio Instagram.',
            'budget_min' => 300000,
            'budget_max' => 1000000,
            'deadline' => now()->addDays(30)->toDateString(),
            'city' => 'Bandung',
            'status' => 'ASSIGNED',
        ]);

        $this->contract = $this->makeFundedContract([400000, 600000]);
    }

    // ---------------------------------------------------------------- jalur sukses

    public function test_start_opens_first_milestone_and_assigns_category_mentor(): void
    {
        // Mentor lain tanpa keahlian kategori dan tanpa beban tidak boleh didahulukan.
        $this->makeMentor(expertise: false);

        $this->as($this->student)
            ->postJson("/api/v1/contracts/{$this->contract->id}/start")
            ->assertOk()
            ->assertJsonPath('data.status', 'IN_PROGRESS');

        $first = $this->milestone(1);
        $this->assertSame('IN_PROGRESS', $first->status);
        $this->assertNotNull($first->started_at);
        $this->assertSame($this->mentor->id, $first->mentor_id);
        $this->assertSame('LOCKED', $this->milestone(2)->status);
        $this->assertDatabaseHas('mentor_assignments', [
            'milestone_id' => $first->id,
            'mentor_id' => $this->mentor->id,
            'status' => 'ACTIVE',
            'fee_eligible' => false,
        ]);
    }

    public function test_full_flow_approves_milestones_in_sequence_and_completes_contract(): void
    {
        $this->startContract();

        // Milestone 1: submit -> mentor APPROVED -> UMKM APPROVED.
        $submission = $this->submitWork($this->milestone(1))->assertCreated()->json('data');
        $this->assertSame(1, $submission['version_no']);
        $this->assertSame('PENDING_MENTOR', $submission['status']);
        $this->assertCount(1, $submission['files']);
        $this->assertArrayNotHasKey('file_url', $submission['files'][0]);

        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])
            ->assertOk()
            ->assertJsonPath('data.status', 'CLIENT_REVIEW');
        $this->assertNotNull($this->milestone(1)->client_review_started_at);
        $this->assertDatabaseHas('submissions', ['id' => $submission['id'], 'status' => 'PENDING_CLIENT']);

        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission['id']}/client-review", ['decision' => 'APPROVED'])
            ->assertOk()
            ->assertJsonPath('data.status', 'APPROVED')
            ->assertJsonPath('data.approved_via', 'CLIENT');

        $this->assertDatabaseHas('submissions', ['id' => $submission['id'], 'status' => 'ACCEPTED']);
        $assignment = MentorAssignment::query()->where('milestone_id', $this->milestone(1)->id)->firstOrFail();
        $this->assertSame('DONE', $assignment->status);
        $this->assertTrue($assignment->fee_eligible);
        $this->assertSame(1, $assignment->review_count);
        $this->assertSame(14400, $assignment->fee_amount);
        $this->assertNotNull($assignment->fee_paid_at);
        $this->assertSame(352000, $this->walletBalance($this->student->id, 'STUDENT'));
        $this->assertSame('PARTIALLY_RELEASED', Escrow::query()->where('contract_id', $this->contract->id)->value('status'));

        // Milestone 2 terbuka otomatis dan mendapat mentor.
        $second = $this->milestone(2);
        $this->assertSame('IN_PROGRESS', $second->status);
        $this->assertSame($this->mentor->id, $second->mentor_id);
        $this->assertSame('IN_PROGRESS', $this->contract->fresh()->status);

        // Milestone terakhir disetujui -> kontrak & project COMPLETED.
        $submission2 = $this->submitWork($second)->json('data');
        $this->as($this->mentor)->postJson("/api/v1/submissions/{$submission2['id']}/mentor-review", ['decision' => 'APPROVED'])->assertOk();
        $this->as($this->umkm)->postJson("/api/v1/submissions/{$submission2['id']}/client-review", ['decision' => 'APPROVED'])->assertOk();

        $this->assertSame('COMPLETED', $this->contract->fresh()->status);
        $this->assertNotNull($this->contract->fresh()->completed_at);

        // Dana dicairkan per milestone (06 bagian 3b): 400.000 + 600.000.
        $this->assertSame(880000, $this->walletBalance($this->student->id, 'STUDENT'));
        $this->assertSame(14400 + 21600, $this->walletBalance($this->mentor->id, 'MENTOR'));
        $this->assertSame(33600 + 50400, $this->walletBalance(null, 'PLATFORM_REVENUE'));
        $this->assertSame(2, MilestoneSettlement::query()->count());
        $escrow = Escrow::query()->where('contract_id', $this->contract->id)->firstOrFail();
        $this->assertSame('RELEASED', $escrow->status);
        $this->assertSame(0, $escrow->held_amount);
        $this->assertSame(1000000, $escrow->released_amount);
        $this->assertSame('COMPLETED', $this->project->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'MILESTONE_CLIENT_REVIEWED', 'entity_id' => $second->id]);
    }

    public function test_mentor_returns_do_not_count_as_revisions_and_third_return_escalates(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);

        for ($round = 1; $round <= 2; $round++) {
            $submission = $this->submitWork($milestone)->assertCreated()->json('data');
            $this->assertSame($round, $submission['version_no']);

            $this->as($this->mentor)
                ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", [
                    'decision' => 'NEEDS_CHANGES',
                    'feedback' => "Perbaiki putaran {$round}",
                ])
                ->assertOk()
                ->assertJsonPath('data.status', 'IN_PROGRESS')
                ->assertJsonPath('data.mentor_return_count', $round)
                ->assertJsonPath('data.revision_count', 0);

            $this->assertDatabaseHas('submissions', ['id' => $submission['id'], 'status' => 'RETURNED_BY_MENTOR']);
        }

        $third = $this->submitWork($milestone)->json('data');
        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$third['id']}/mentor-review", [
                'decision' => 'NEEDS_CHANGES',
                'feedback' => 'Masih belum sesuai brief',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'ESCALATED')
            ->assertJsonPath('data.mentor_return_count', 3)
            ->assertJsonPath('data.revision_count', 0);

        $this->assertDatabaseHas('admin_alerts', [
            'type' => 'MENTOR_RETURN_LIMIT',
            'reference_type' => 'MILESTONE',
            'reference_id' => $milestone->id,
            'status' => 'OPEN',
        ]);

        $assignment = MentorAssignment::query()->where('milestone_id', $milestone->id)->firstOrFail();
        $this->assertTrue($assignment->fee_eligible);
        $this->assertSame(3, $assignment->review_count);
        $this->assertSame('ACTIVE', $assignment->status);

        // Milestone ESCALATED: mahasiswa tidak bisa submit lagi sampai admin memutuskan.
        $this->submitWork($milestone)->assertStatus(409);
    }

    public function test_umkm_revision_limit_is_two_per_milestone(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);

        for ($round = 1; $round <= 2; $round++) {
            $submission = $this->reachClientReview($milestone);

            $this->as($this->umkm)
                ->postJson("/api/v1/submissions/{$submission}/client-review", [
                    'decision' => 'REVISION_REQUESTED',
                    'feedback' => "Revisi ke-{$round}",
                ])
                ->assertOk()
                ->assertJsonPath('data.status', 'IN_PROGRESS')
                ->assertJsonPath('data.revision_count', $round);

            $this->assertDatabaseHas('submissions', ['id' => $submission, 'status' => 'REVISION_REQUESTED']);
        }

        // Submission hasil revisi tetap lewat mentor dulu.
        $submission = $this->submitWork($milestone)->json('data');
        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission['id']}/client-review", ['decision' => 'APPROVED'])
            ->assertStatus(409);
        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])
            ->assertOk();

        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission['id']}/client-review", [
                'decision' => 'REVISION_REQUESTED',
                'feedback' => 'Revisi ke-3',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');

        $fresh = $this->milestone(1);
        $this->assertSame('CLIENT_REVIEW', $fresh->status);
        $this->assertSame(2, $fresh->revision_count);

        // Setelah revisi habis, UMKM masih bisa Approve.
        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission['id']}/client-review", ['decision' => 'APPROVED'])
            ->assertOk()
            ->assertJsonPath('data.status', 'APPROVED');
    }

    public function test_dispute_is_only_allowed_after_revisions_are_used_up(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);
        $this->reachClientReview($milestone);

        $this->as($this->umkm)
            ->postJson("/api/v1/milestones/{$milestone->id}/disputes", ['reason' => 'Belum sesuai'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');

        Milestone::query()->whereKey($milestone->id)->update(['revision_count' => 2]);

        $this->as($this->umkm)
            ->postJson("/api/v1/milestones/{$milestone->id}/disputes", ['reason' => 'Hasil tetap tidak sesuai brief'])
            ->assertOk()
            ->assertJsonPath('data.status', 'ESCALATED');

        $this->assertDatabaseHas('admin_alerts', [
            'type' => 'REVISION_LIMIT_DISPUTE',
            'reference_id' => $milestone->id,
            'status' => 'OPEN',
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'MILESTONE_DISPUTED', 'entity_id' => $milestone->id]);

        // Sengketa kedua (misal dari mahasiswa) ditolak karena milestone sudah ESCALATED.
        $this->as($this->student)
            ->postJson("/api/v1/milestones/{$milestone->id}/disputes", ['reason' => 'Ikut mengajukan'])
            ->assertStatus(409);
        $this->assertSame(1, AdminAlert::query()->where('reference_id', $milestone->id)->count());
    }

    public function test_student_can_dispute_after_revisions_are_used_up(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);
        $this->reachClientReview($milestone);
        Milestone::query()->whereKey($milestone->id)->update(['revision_count' => 2]);

        $this->as($this->student)
            ->postJson("/api/v1/milestones/{$milestone->id}/disputes", ['reason' => 'UMKM menolak approve tanpa alasan'])
            ->assertOk()
            ->assertJsonPath('data.status', 'ESCALATED');
    }

    public function test_review_queue_lists_only_milestones_assigned_to_the_mentor(): void
    {
        $this->startContract();
        $this->submitWork($this->milestone(1))->assertCreated();
        $otherMentor = $this->makeMentor(expertise: true);

        $this->as($this->mentor)
            ->getJson('/api/v1/mentor/review-queue')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $this->milestone(1)->id)
            ->assertJsonPath('data.0.submissions.0.status', 'PENDING_MENTOR')
            ->assertJsonPath('meta.total', 1);

        $this->as($otherMentor)
            ->getJson('/api/v1/mentor/review-queue')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_submission_files_are_only_downloadable_by_allowed_parties(): void
    {
        $this->startContract();
        $submission = Submission::query()->findOrFail($this->submitWork($this->milestone(1))->json('data.id'));
        $file = $submission->files()->firstOrFail();
        $url = "/api/v1/submissions/{$submission->id}/files/{$file->id}";

        $this->as($this->student)->get($url)->assertOk();
        $this->as($this->mentor)->get($url)->assertOk();

        // UMKM belum boleh melihat hasil yang belum lolos mentor.
        $this->as($this->umkm)->getJson($url)->assertStatus(403);
        $this->as($this->makeMentor(expertise: true))->getJson($url)->assertStatus(403);

        $this->as($this->mentor)->postJson("/api/v1/submissions/{$submission->id}/mentor-review", ['decision' => 'APPROVED'])->assertOk();
        $this->as($this->umkm)->get($url)->assertOk();
    }

    public function test_mentor_without_capacity_is_skipped_and_assignment_is_retried_on_submit(): void
    {
        MentorProfile::query()->where('user_id', $this->mentor->id)->update(['max_active_reviews' => 0]);

        $this->startContract();
        $milestone = $this->milestone(1);
        $this->assertNull($milestone->mentor_id);
        $this->assertSame(0, MentorAssignment::query()->count());

        $backup = $this->makeMentor(expertise: false);
        $submission = $this->submitWork($milestone)->assertCreated()->json('data');

        $this->assertSame($backup->id, $this->milestone(1)->mentor_id);
        $this->as($backup)
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])
            ->assertOk();
    }

    // ---------------------------------------------------------------- 409 transisi tidak valid

    public function test_invalid_transitions_return_409(): void
    {
        // Mulai kerja dua kali.
        $this->startContract();
        $this->as($this->student)->postJson("/api/v1/contracts/{$this->contract->id}/start")->assertStatus(409);

        // Submit milestone yang masih LOCKED.
        $this->submitWork($this->milestone(2))->assertStatus(409)->assertJsonPath('error.code', 'INVALID_STATE_TRANSITION');

        $milestone = $this->milestone(1);
        $first = $this->submitWork($milestone)->json('data');

        // Submit ganda saat MENTOR_REVIEW.
        $this->submitWork($milestone)->assertStatus(409);
        $this->assertSame(1, Submission::query()->where('milestone_id', $milestone->id)->count());

        // UMKM mereview sebelum mentor.
        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$first['id']}/client-review", ['decision' => 'APPROVED'])
            ->assertStatus(409);

        // Double click mentor review: yang kedua 409 dan tidak menggandakan hitungan.
        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$first['id']}/mentor-review", ['decision' => 'NEEDS_CHANGES', 'feedback' => 'Ulangi'])
            ->assertOk();
        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$first['id']}/mentor-review", ['decision' => 'NEEDS_CHANGES', 'feedback' => 'Ulangi'])
            ->assertStatus(409);
        $this->assertSame(1, $this->milestone(1)->mentor_return_count);

        // Submission lama tidak bisa direview setelah ada versi baru.
        $second = $this->submitWork($milestone)->json('data');
        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$first['id']}/mentor-review", ['decision' => 'APPROVED'])
            ->assertStatus(409);

        // Double click approve UMKM.
        $this->as($this->mentor)->postJson("/api/v1/submissions/{$second['id']}/mentor-review", ['decision' => 'APPROVED'])->assertOk();
        $this->as($this->umkm)->postJson("/api/v1/submissions/{$second['id']}/client-review", ['decision' => 'APPROVED'])->assertOk();
        $this->as($this->umkm)->postJson("/api/v1/submissions/{$second['id']}/client-review", ['decision' => 'APPROVED'])->assertStatus(409);
    }

    public function test_start_requires_funded_contract(): void
    {
        $this->contract->update(['status' => 'AWAITING_PAYMENT']);

        $this->as($this->student)
            ->postJson("/api/v1/contracts/{$this->contract->id}/start")
            ->assertStatus(409);

        $this->assertSame('LOCKED', $this->milestone(1)->status);
    }

    public function test_milestone_actions_are_frozen_while_cancellation_is_requested(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);
        $submission = $this->submitWork($milestone)->json('data');

        $this->contract->update(['status' => 'CANCELLATION_REQUESTED']);

        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])
            ->assertStatus(409);
        $this->assertSame('MENTOR_REVIEW', $this->milestone(1)->status);

        Milestone::query()->whereKey($milestone->id)->update(['status' => 'IN_PROGRESS']);
        $this->submitWork($milestone)->assertStatus(409);
    }

    // ---------------------------------------------------------------- 422 validasi

    public function test_validation_rules_return_422(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);

        $this->as($this->student)
            ->postJson("/api/v1/milestones/{$milestone->id}/submissions", ['notes' => 'tanpa file'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $this->as($this->student)
            ->post("/api/v1/milestones/{$milestone->id}/submissions", [
                'files' => [UploadedFile::fake()->create('virus.exe', 10, 'application/octet-stream')],
            ], ['Accept' => 'application/json'])
            ->assertStatus(422);

        $submission = $this->submitWork($milestone)->json('data');

        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'NEEDS_CHANGES'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'REVISION_REQUESTED'])
            ->assertStatus(422);

        $this->as($this->mentor)->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])->assertOk();

        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission['id']}/client-review", ['decision' => 'REVISION_REQUESTED'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertSame(0, $this->milestone(1)->revision_count);
    }

    // ---------------------------------------------------------------- 403 role / kepemilikan

    public function test_wrong_roles_and_non_owners_get_403(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);

        $otherStudent = $this->makeStudent();
        $this->submitWork($milestone, $otherStudent)->assertStatus(403);
        $this->as($this->mentor)
            ->post("/api/v1/milestones/{$milestone->id}/submissions", ['files' => [$this->fakeFile()]], ['Accept' => 'application/json'])
            ->assertStatus(403);
        $this->as($this->otherUser())->postJson("/api/v1/contracts/{$this->contract->id}/start")->assertStatus(403);

        $submission = $this->submitWork($milestone)->json('data');

        // Mentor lain (tidak ditugaskan), mahasiswa, dan UMKM tidak boleh mentor-review.
        $this->as($this->makeMentor(expertise: true))
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])
            ->assertStatus(403);
        $this->as($this->student)
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])
            ->assertStatus(403);
        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])
            ->assertStatus(403);
        $this->assertSame('MENTOR_REVIEW', $this->milestone(1)->status);

        $this->as($this->mentor)->postJson("/api/v1/submissions/{$submission['id']}/mentor-review", ['decision' => 'APPROVED'])->assertOk();

        // UMKM lain, mentor, dan mahasiswa tidak boleh client-review.
        $this->as($this->otherUser())
            ->postJson("/api/v1/submissions/{$submission['id']}/client-review", ['decision' => 'APPROVED'])
            ->assertStatus(403);
        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$submission['id']}/client-review", ['decision' => 'APPROVED'])
            ->assertStatus(403);
        $this->as($this->student)
            ->postJson("/api/v1/submissions/{$submission['id']}/client-review", ['decision' => 'APPROVED'])
            ->assertStatus(403);

        // Hanya pihak kontrak yang boleh mengajukan sengketa; mentor ditolak oleh role.
        $this->as($this->otherUser())
            ->postJson("/api/v1/milestones/{$milestone->id}/disputes", ['reason' => 'x'])
            ->assertStatus(403);
        $this->as($this->mentor)
            ->postJson("/api/v1/milestones/{$milestone->id}/disputes", ['reason' => 'x'])
            ->assertStatus(403);

        // Antrean review hanya untuk mentor.
        $this->as($this->student)->getJson('/api/v1/mentor/review-queue')->assertStatus(403);

        $this->assertSame('CLIENT_REVIEW', $this->milestone(1)->status);
    }

    // ---------------------------------------------------------------- race condition (berurutan)

    public function test_repeated_revision_requests_never_exceed_the_limit(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);
        $submission = $this->reachClientReview($milestone);
        Milestone::query()->whereKey($milestone->id)->update(['revision_count' => 1]);

        // Dua request revisi beruntun untuk submission yang sama (double click):
        // yang pertama sukses, yang kedua 409 karena milestone sudah IN_PROGRESS.
        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission}/client-review", ['decision' => 'REVISION_REQUESTED', 'feedback' => 'a'])
            ->assertOk();
        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission}/client-review", ['decision' => 'REVISION_REQUESTED', 'feedback' => 'b'])
            ->assertStatus(409);

        $this->assertSame(2, $this->milestone(1)->revision_count);
        $this->assertSame(1, DB::table('submission_reviews')->where('reviewer_role', 'UMKM')->count());
    }

    public function test_client_approval_is_rolled_back_when_escrow_cannot_release(): void
    {
        $this->startContract();
        $milestone = $this->milestone(1);
        $submission = $this->reachClientReview($milestone);

        // Simulasikan escrow yang tidak lagi menahan dana (data rusak / sudah dialokasikan).
        Escrow::query()->where('contract_id', $this->contract->id)->update(['status' => 'PENDING_FUNDING']);

        $this->as($this->umkm)
            ->postJson("/api/v1/submissions/{$submission}/client-review", ['decision' => 'APPROVED'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');

        $this->assertSame('CLIENT_REVIEW', $this->milestone(1)->status);
        $this->assertSame('LOCKED', $this->milestone(2)->status);
        $this->assertSame('PENDING_CLIENT', Submission::query()->find($submission)->status);
        $this->assertSame(0, MilestoneSettlement::query()->count());
        $this->assertSame(0, $this->walletBalance($this->student->id, 'STUDENT'));
    }

    // ---------------------------------------------------------------- helper

    private function walletBalance(?string $userId, string $type): int
    {
        return (int) Wallet::query()->where('user_id', $userId)->where('type', $type)->value('balance');
    }

    private function as(User $user): self
    {
        // Sanctum menyimpan user di guard antar-request dalam satu test.
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('test')->plainTextToken);
    }

    private function startContract(): void
    {
        $this->as($this->student)->postJson("/api/v1/contracts/{$this->contract->id}/start")->assertOk();
    }

    private function submitWork(Milestone $milestone, ?User $student = null): TestResponse
    {
        return $this->as($student ?? $this->student)->post(
            "/api/v1/milestones/{$milestone->id}/submissions",
            ['notes' => 'Hasil kerja siap direview', 'files' => [$this->fakeFile()]],
            ['Accept' => 'application/json'],
        );
    }

    /** Submit + mentor APPROVED, mengembalikan id submission yang menunggu UMKM. */
    private function reachClientReview(Milestone $milestone): string
    {
        $submission = $this->submitWork($milestone)->assertCreated()->json('data.id');
        $this->as($this->mentor)
            ->postJson("/api/v1/submissions/{$submission}/mentor-review", ['decision' => 'APPROVED'])
            ->assertOk();

        return $submission;
    }

    private function milestone(int $sequence): Milestone
    {
        return Milestone::query()
            ->where('contract_id', $this->contract->id)
            ->where('sequence', $sequence)
            ->firstOrFail();
    }

    private function fakeFile(): UploadedFile
    {
        return UploadedFile::fake()->create('hasil-feed.pdf', 120, 'application/pdf');
    }

    /** @param  list<int>  $amounts */
    private function makeFundedContract(array $amounts): Contract
    {
        $contract = Contract::query()->create([
            'project_id' => $this->project->id,
            'umkm_id' => $this->umkm->id,
            'student_id' => $this->student->id,
            'total_amount' => array_sum($amounts),
            'platform_fee_pct' => 12,
            'mentor_share_pct' => 30,
            'mentor_min_fee' => 10000,
            'status' => 'FUNDED',
            'funded_at' => now(),
        ]);

        foreach ($amounts as $index => $amount) {
            Milestone::query()->create([
                'contract_id' => $contract->id,
                'sequence' => $index + 1,
                'title' => 'Milestone '.($index + 1),
                'amount' => $amount,
                'status' => 'LOCKED',
                'max_revisions' => 2,
                'max_mentor_returns' => 3,
            ]);
        }

        // Escrow didanai lewat ledger seperti hasil webhook pembayaran.
        $escrow = Escrow::query()->create(['contract_id' => $contract->id, 'status' => 'PENDING_FUNDING']);
        $payment = Payment::query()->create([
            'payer_id' => $this->umkm->id,
            'purpose' => 'ESCROW_FUNDING',
            'reference_type' => 'CONTRACT',
            'reference_id' => $contract->id,
            'amount' => $contract->total_amount,
            'gateway_fee' => 4000,
            'gateway' => 'MOCK',
            'gateway_ref' => 'MOCK-'.$contract->id,
            'status' => 'PAID',
            'paid_at' => now(),
        ]);
        DB::transaction(fn () => app(LedgerService::class)->fundEscrow($escrow, $payment));

        return $contract;
    }

    private function makeStudent(): User
    {
        $student = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $university = University::query()->firstOrCreate(
            ['email_domain' => 'example.ac.id'],
            ['name' => 'Kampus Example', 'city' => 'Bandung', 'is_partner' => true],
        );
        StudentProfile::query()->create([
            'user_id' => $student->id,
            'university_id' => $university->id,
            'verification_status' => 'VERIFIED',
            'is_available' => true,
        ]);

        return $student;
    }

    private function makeMentor(bool $expertise): User
    {
        $mentor = User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']);
        $profile = MentorProfile::query()->create([
            'user_id' => $mentor->id,
            'title' => 'Senior Designer',
            'institution' => 'Studio',
            'verification_status' => 'VERIFIED',
            'max_active_reviews' => 5,
            'is_available' => true,
        ]);

        if ($expertise) {
            $profile->expertises()->attach($this->category->id);
        }

        return $mentor;
    }

    private function otherUser(): User
    {
        return User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
    }
}
