<?php

use App\Models\AdminAlert;
use App\Models\MentorAssignment;
use App\Models\MilestoneSettlement;
use App\Models\PlatformSetting;
use App\Models\Submission;
use App\Models\User;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\BuildsContracts;
use Tests\TestCase;

/**
 * Fase 6 — panel admin: keputusan atas milestone ESCALATED, mentor, alert, setting, laporan, suspend.
 * Acuan: 08-api-endpoints.md (Admin), 04-state-diagram.md bagian 3 & 7, 05-sequence-diagram.md bagian 6.
 */
class AdminPanelTest extends TestCase
{
    use BuildsContracts, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpParties();
    }

    // ---------------------------------------------------------------- force approve

    public function test_force_approve_requires_follow_up_deadline_and_releases_funds(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'ESCALATED'], [600000, 'LOCKED']]);
        $milestone = $this->milestoneOf($contract, 1);
        $this->assignMentor($milestone, $this->mentor, eligible: true);
        $this->makeSubmission($milestone, 'PENDING_CLIENT');
        $alert = $this->alert('UMKM_UNRESPONSIVE', $milestone->id, 'FOLLOWED_UP');
        $url = "/api/v1/admin/milestones/{$milestone->id}/force-approve";

        $this->actingWith($this->umkm)->postJson($url)->assertStatus(403);
        $this->actingWith($this->admin)->postJson($url)->assertStatus(409);

        $alert->update(['status' => 'AWAITING_DECISION']);
        $this->actingWith($this->admin)->postJson($url, ['notes' => 'Hasil sesuai brief'])
            ->assertOk()
            ->assertJsonPath('data.status', 'APPROVED')
            ->assertJsonPath('data.approved_via', 'ADMIN_FORCE');

        $this->assertSame('RESOLVED', $alert->fresh()->status);
        $this->assertSame(352000, $this->balance($this->student->id, 'STUDENT'));
        $this->assertSame(14400, $this->balance($this->mentor->id, 'MENTOR'));
        $this->assertSame('IN_PROGRESS', $this->milestoneOf($contract, 2)->status);
        $this->assertSame('ACCEPTED', Submission::query()->where('milestone_id', $milestone->id)->value('status'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'MILESTONE_FORCE_APPROVED', 'entity_id' => $milestone->id]);
        $this->assertDatabaseHas('submission_reviews', ['reviewer_role' => 'ADMIN', 'decision' => 'APPROVED']);
        $this->assertLedgerReconciles();

        // Hanya untuk milestone ESCALATED.
        $this->actingWith($this->admin)->postJson($url)->assertStatus(409);
    }

    public function test_return_to_student_does_not_count_as_umkm_revision(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'ESCALATED']]);
        $milestone = $this->milestoneOf($contract, 1);
        $milestone->update(['revision_count' => 2]);
        $submission = $this->makeSubmission($milestone, 'PENDING_CLIENT');
        $alert = $this->alert('REVISION_LIMIT_DISPUTE', $milestone->id);

        $this->actingWith($this->admin)->postJson("/api/v1/admin/milestones/{$milestone->id}/return-to-student", [])->assertStatus(422);
        $this->actingWith($this->admin)->postJson("/api/v1/admin/milestones/{$milestone->id}/return-to-student", ['notes' => 'Perbaiki warna logo'])
            ->assertOk()->assertJsonPath('data.status', 'IN_PROGRESS')->assertJsonPath('data.revision_count', 2);

        $this->assertSame('REVISION_REQUESTED', $submission->fresh()->status);
        $this->assertSame('RESOLVED', $alert->fresh()->status);
    }

    public function test_extra_chance_and_forward_to_client_after_mentor_return_limit(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'ESCALATED']]);
        $milestone = $this->milestoneOf($contract, 1);
        $milestone->update(['mentor_return_count' => 3]);
        $this->assignMentor($milestone, $this->mentor, eligible: true, reviews: 3);
        $submission = $this->makeSubmission($milestone, 'RETURNED_BY_MENTOR', 3);
        $this->alert('MENTOR_RETURN_LIMIT', $milestone->id);

        $this->actingWith($this->admin)->postJson("/api/v1/admin/milestones/{$milestone->id}/extra-chance")
            ->assertOk()->assertJsonPath('data.status', 'IN_PROGRESS')->assertJsonPath('data.mentor_return_count', 0);
        $this->assertSame(0, AdminAlert::query()->where('status', '!=', 'RESOLVED')->count());

        // Kasus lain: teruskan ke UMKM tanpa persetujuan mentor.
        $milestone->refresh()->update(['status' => 'ESCALATED', 'mentor_return_count' => 3]);
        $this->actingWith($this->admin)->postJson("/api/v1/admin/milestones/{$milestone->id}/forward-to-client", ['notes' => 'Sudah layak'])
            ->assertOk()->assertJsonPath('data.status', 'CLIENT_REVIEW');
        $this->assertSame('PENDING_CLIENT', $submission->fresh()->status);
        $this->assertNotNull($milestone->fresh()->client_review_started_at);

        $this->actingWith($this->umkm)->postJson("/api/v1/submissions/{$submission->id}/client-review", ['decision' => 'APPROVED'])->assertOk();
        $this->assertSame('APPROVED', $milestone->fresh()->status);
    }

    public function test_extra_chance_is_rejected_for_non_mentor_escalations(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'ESCALATED']]);
        $milestone = $this->milestoneOf($contract, 1);
        $this->makeSubmission($milestone, 'PENDING_CLIENT');

        $this->actingWith($this->admin)->postJson("/api/v1/admin/milestones/{$milestone->id}/extra-chance")->assertStatus(409);
    }

    public function test_reassign_mentor_replaces_assignment_and_both_mentors_get_paid(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'ESCALATED']]);
        $milestone = $this->milestoneOf($contract, 1);
        $milestone->update(['mentor_return_count' => 3]);
        $old = $this->assignMentor($milestone, $this->mentor, eligible: true, reviews: 3);
        $this->makeSubmission($milestone, 'RETURNED_BY_MENTOR');
        $url = "/api/v1/admin/milestones/{$milestone->id}/reassign-mentor";

        $unverified = User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']);
        $this->actingWith($this->admin)->postJson($url, ['mentor_id' => $unverified->id])->assertStatus(422);
        $this->actingWith($this->admin)->postJson($url, ['mentor_id' => $this->mentor->id])->assertStatus(422);

        $newMentor = $this->makeMentor();
        $this->actingWith($this->admin)->postJson($url, ['mentor_id' => $newMentor->id])
            ->assertOk()->assertJsonPath('data.status', 'IN_PROGRESS')->assertJsonPath('data.mentor_return_count', 0)
            ->assertJsonPath('data.mentor_id', $newMentor->id);
        $this->assertSame('REPLACED', $old->fresh()->status);

        // Mentor baru mereview lalu UMKM approve: mentor lama (fee_eligible) tetap dibayar, selisih ditanggung platform.
        $submission = $this->makeSubmission($milestone, 'PENDING_MENTOR', 2);
        $milestone->refresh()->update(['status' => 'MENTOR_REVIEW']);
        $this->actingWith($newMentor)->postJson("/api/v1/submissions/{$submission->id}/mentor-review", ['decision' => 'APPROVED'])->assertOk();
        $this->actingWith($this->umkm)->postJson("/api/v1/submissions/{$submission->id}/client-review", ['decision' => 'APPROVED'])->assertOk();

        $this->assertSame(14400, $this->balance($this->mentor->id, 'MENTOR'));
        $this->assertSame(14400, $this->balance($newMentor->id, 'MENTOR'));
        $this->assertSame(28800, MilestoneSettlement::query()->sole()->mentor_fee);
        $this->assertSame(2, MentorAssignment::query()->whereNotNull('fee_paid_at')->count());
        $this->assertLedgerReconciles();

        // Milestone yang sudah selesai tidak bisa diganti mentornya.
        $this->actingWith($this->admin)->postJson($url)->assertStatus(409);
    }

    // ---------------------------------------------------------------- alert

    public function test_alert_queue_and_detail(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'CLIENT_REVIEW']]);
        $milestone = $this->milestoneOf($contract, 1);
        $this->makeSubmission($milestone, 'PENDING_CLIENT');
        $medium = $this->alert('MENTOR_OVERDUE', $milestone->id);
        $high = $this->alert('UMKM_UNRESPONSIVE', $milestone->id, 'OPEN', 'HIGH');
        $this->alert('STUDENT_OVERDUE', $milestone->id, 'RESOLVED');

        $this->actingWith($this->admin)->getJson('/api/v1/admin/alerts')
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.id', $high->id)->assertJsonPath('data.1.id', $medium->id);
        $this->actingWith($this->admin)->getJson('/api/v1/admin/alerts?status=RESOLVED')->assertOk()->assertJsonCount(1, 'data');
        $this->actingWith($this->admin)->getJson("/api/v1/admin/alerts/{$high->id}")
            ->assertOk()->assertJsonPath('data.reference.id', $milestone->id)->assertJsonCount(1, 'data.reference.submissions');
        $this->actingWith($this->student)->getJson('/api/v1/admin/alerts')->assertStatus(403);
    }

    // ---------------------------------------------------------------- setting

    public function test_settings_can_be_read_and_updated_within_business_limits(): void
    {
        $this->actingWith($this->admin)->getJson('/api/v1/admin/settings')->assertOk()->assertJsonPath('data.platform_fee_pct', 12);

        $this->updateSettings(['platform_fee_pct' => 20])->assertStatus(422);
        $this->updateSettings(['unknown_key' => 1])->assertStatus(422);
        $this->updateSettings(['umkm_review_reminder_days' => ['x']])->assertStatus(422);
        $this->updateSettings(['mentor_overdue_alert_hours' => 24])->assertStatus(422);
        $this->actingWith($this->umkm)->putJson('/api/v1/admin/settings', ['settings' => ['platform_fee_pct' => 11]])->assertStatus(403);

        $this->updateSettings(['platform_fee_pct' => 12.5, 'umkm_review_reminder_days' => [2, 5, 9]])
            ->assertOk()->assertJsonPath('data.platform_fee_pct', 12.5)->assertJsonPath('data.umkm_review_reminder_days', [2, 5, 9]);

        // Cache dibersihkan: service langsung membaca nilai baru.
        $this->assertSame(12.5, app(PlatformSettingsService::class)->number('platform_fee_pct'));
        $this->assertSame(12.5, PlatformSetting::query()->find('platform_fee_pct')->value);
        $this->assertDatabaseHas('audit_logs', ['action' => 'PLATFORM_SETTINGS_UPDATED']);
    }

    // ---------------------------------------------------------------- laporan keuangan

    public function test_finance_report_summarizes_ledger(): void
    {
        $contract = $this->makeContract('IN_PROGRESS', [[400000, 'APPROVED'], [600000, 'IN_PROGRESS']]);
        $this->releaseMilestone($contract, $this->milestoneOf($contract, 1));

        $this->actingWith($this->admin)->getJson('/api/v1/admin/reports/finance')
            ->assertOk()
            ->assertJsonPath('data.gmv', 1000000)
            ->assertJsonPath('data.gateway_fees_paid_by_umkm', 4000)
            ->assertJsonPath('data.platform_fee', 48000)
            ->assertJsonPath('data.mentor_fee', 14400)
            ->assertJsonPath('data.platform_net', 33600)
            ->assertJsonPath('data.escrow_held', 600000)
            ->assertJsonPath('data.wallet_balances.STUDENT', 352000);

        $this->actingWith($this->admin)->getJson('/api/v1/admin/reports/finance?from='.now()->addDays(2)->toDateString())
            ->assertOk()->assertJsonPath('data.gmv', 0)->assertJsonPath('data.escrow_held', 600000);
        $this->actingWith($this->admin)->getJson('/api/v1/admin/reports/finance?from=2026-13-01')->assertStatus(422);
    }

    // ---------------------------------------------------------------- suspend

    public function test_suspend_user_revokes_access(): void
    {
        $token = $this->student->createToken('t')->plainTextToken;

        $this->actingWith($this->admin)->postJson("/api/v1/admin/users/{$this->student->id}/suspend", [])->assertStatus(422);
        $this->actingWith($this->admin)->postJson("/api/v1/admin/users/{$this->student->id}/suspend", ['reason' => 'Transaksi di luar platform'])
            ->assertOk()->assertJsonPath('data.status', 'SUSPENDED');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/notifications')->assertStatus(401);
        $this->assertSame(0, $this->student->tokens()->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'USER_SUSPENDED', 'entity_id' => $this->student->id]);

        $this->actingWith($this->admin)->postJson("/api/v1/admin/users/{$this->student->id}/suspend", ['reason' => 'x'])->assertStatus(409);
        $this->actingWith($this->admin)->postJson("/api/v1/admin/users/{$this->admin->id}/suspend", ['reason' => 'x'])->assertStatus(422);
    }

    // ---------------------------------------------------------------- helper

    private function alert(string $type, string $milestoneId, string $status = 'OPEN', string $severity = 'MEDIUM'): AdminAlert
    {
        return AdminAlert::query()->create([
            'type' => $type, 'severity' => $severity, 'reference_type' => 'MILESTONE', 'reference_id' => $milestoneId, 'status' => $status,
        ]);
    }

    private function updateSettings(array $settings)
    {
        return $this->actingWith($this->admin)->putJson('/api/v1/admin/settings', ['settings' => $settings]);
    }
}
