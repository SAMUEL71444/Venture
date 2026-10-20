<?php

use App\Models\AdminAlert;
use App\Models\Application;
use App\Models\Contract;
use App\Models\Escrow;
use App\Models\Invitation;
use App\Models\MentorAssignment;
use App\Models\Milestone;
use App\Models\Payment;
use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\Submission;
use App\Models\User;
use App\Models\UserNotification;
use App\Modules\ledger\Services\LedgerService;
use App\Modules\scheduler\Jobs\ScheduledCheckJob;
use App\Modules\scheduler\Services\SchedulerPlanner;
use Carbon\CarbonImmutable;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Fase 5 — scheduler, reminder & eskalasi.
 * Acuan: 07-scheduler-dan-notifikasi.md, 04-state-diagram.md bagian 3 & 7, 05-sequence-diagram.md bagian 6.
 */
class SchedulerTest extends TestCase
{
    use RefreshDatabase;

    private User $umkm;

    private User $student;

    private User $mentor;

    private User $admin;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(CarbonImmutable::parse('2026-10-20 03:00:00', 'UTC'));
        $this->seed(PlatformSettingsSeeder::class);

        $this->umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $this->student = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $this->mentor = User::factory()->create(['role' => 'MENTOR', 'status' => 'ACTIVE']);
        $this->admin = User::factory()->create(['role' => 'ADMIN', 'status' => 'ACTIVE']);
        $this->project = Project::query()->create([
            'umkm_id' => $this->umkm->id,
            'category_id' => ServiceCategory::query()->create(['name' => 'Branding', 'slug' => 'branding'])->id,
            'title' => 'Setup Instagram',
            'description' => 'Desc',
            'budget_min' => 1,
            'budget_max' => 1,
            'deadline' => '2026-11-30',
            'status' => 'ASSIGNED',
        ]);
    }

    // ---------------------------------------------------------------- Mulai Kerja

    public function test_start_reminders_and_student_not_started_alert(): void
    {
        $contract = $this->contract('FUNDED', ['funded_at' => now()]);

        $this->travel(23)->hours();
        $this->sweep();
        $this->assertSame(0, $this->countNotifications($this->student, 'START_REMINDER'));

        $this->travel(1)->hours();
        $this->sweep();
        $this->sweep(); // idempotent
        $this->assertSame(1, $this->countNotifications($this->student, 'START_REMINDER'));

        $this->travel(48)->hours();
        $this->sweep();
        $this->assertSame(2, $this->countNotifications($this->student, 'START_REMINDER'));
        $this->assertSame(0, AdminAlert::query()->count());

        $this->travel(4)->days();
        $this->sweep();
        $this->assertSame(1, $this->countNotifications($this->umkm, 'STUDENT_NOT_STARTED'));
        $this->assertDatabaseHas('admin_alerts', ['type' => 'STUDENT_NOT_STARTED', 'reference_id' => $contract->id, 'status' => 'OPEN']);
        $this->assertSame(1, $this->countNotifications($this->admin, 'ADMIN_ALERT'));

        // Tidak ada auto-start.
        $this->assertSame('FUNDED', $contract->fresh()->status);
    }

    public function test_start_reminders_stop_once_work_has_started(): void
    {
        $contract = $this->contract('FUNDED', ['funded_at' => now()]);
        $contract->update(['status' => 'IN_PROGRESS']);

        $this->travel(8)->days();
        $this->runCheck(SchedulerPlanner::CONTRACT_START, $contract->id);

        $this->assertSame(0, UserNotification::query()->count());
    }

    // ---------------------------------------------------------------- SLA mentor

    public function test_mentor_sla_reminder_overdue_alert_and_auto_resolve(): void
    {
        [$contract, $milestone] = $this->milestoneIn('MENTOR_REVIEW');
        $submission = $this->submission($milestone, 'PENDING_MENTOR');
        $this->assign($milestone);

        $this->travel(48)->hours();
        $this->sweep();
        $this->assertSame(1, $this->countNotifications($this->mentor, 'MENTOR_REVIEW_REMINDER'));
        $this->assertSame(0, AdminAlert::query()->count());

        $this->travel(24)->hours();
        $this->sweep();
        $this->assertDatabaseHas('admin_alerts', ['type' => 'MENTOR_OVERDUE', 'reference_id' => $milestone->id, 'status' => 'OPEN']);

        // Mentor akhirnya mereview -> alert MENTOR_OVERDUE ditutup otomatis.
        $this->as($this->mentor)->postJson("/api/v1/submissions/{$submission->id}/mentor-review", ['decision' => 'APPROVED'])->assertOk();
        $this->assertSame('RESOLVED', AdminAlert::query()->where('type', 'MENTOR_OVERDUE')->value('status'));
    }

    public function test_unassigned_milestone_alerts_admin_at_sla(): void
    {
        [, $milestone] = $this->milestoneIn('MENTOR_REVIEW');
        $this->submission($milestone, 'PENDING_MENTOR');

        $this->travel(48)->hours();
        $this->sweep();

        $this->assertDatabaseHas('admin_alerts', ['type' => 'MENTOR_OVERDUE', 'reference_id' => $milestone->id]);
    }

    // ---------------------------------------------------------------- UMKM tidak merespons

    public function test_full_umkm_unresponsive_escalation_chain(): void
    {
        [$contract, $milestone] = $this->milestoneIn('CLIENT_REVIEW', ['client_review_started_at' => now()]);

        foreach ([3 => 1, 7 => 2, 10 => 3] as $day => $expected) {
            $this->travelTo(CarbonImmutable::parse('2026-10-20 03:00:00')->addDays($day));
            $this->sweep();
            $this->assertSame($expected, $this->countNotifications($this->umkm, 'REVIEW_REMINDER'), "day {$day}");
        }
        $this->assertStringContainsString('admin akan menghubungi', UserNotification::query()->where('type', 'REVIEW_REMINDER')->latest('created_at')->latest('id')->value('body'));

        // H+14: alert MEDIUM, milestone tetap CLIENT_REVIEW.
        $this->travelTo(CarbonImmutable::parse('2026-10-20 03:00:00')->addDays(14));
        $this->sweep();
        $alert = AdminAlert::query()->where('type', 'UMKM_UNRESPONSIVE')->sole();
        $this->assertSame(['OPEN', 'MEDIUM'], [$alert->status, $alert->severity]);
        $this->assertSame('CLIENT_REVIEW', $milestone->fresh()->status);
        $this->assertSame(1, $this->countNotifications($this->admin, 'ADMIN_ALERT'));

        // 2 hari tanpa follow up -> HIGH.
        $this->travel(2)->days();
        $this->sweep();
        $this->assertSame('HIGH', $alert->fresh()->severity);

        // Admin follow up -> FOLLOWED_UP, batas 7 hari, UMKM & mahasiswa diberi tahu.
        $this->as($this->admin)->postJson("/api/v1/admin/alerts/{$alert->id}/follow-ups", [
            'channel' => 'TELEPON', 'outcome' => 'TIDAK_DIANGKAT', 'notes' => 'Ditelepon 2x',
        ])->assertCreated()->assertJsonPath('data.status', 'FOLLOWED_UP');
        $deadline = $alert->fresh()->follow_up_deadline;
        $this->assertEquals(now()->addDays(7)->timestamp, $deadline->timestamp);
        $this->assertSame(1, $this->countNotifications($this->umkm, 'FOLLOW_UP_STARTED'));
        $this->assertSame(1, $this->countNotifications($this->student, 'FOLLOW_UP_STARTED'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'ALERT_FOLLOWED_UP', 'entity_id' => $alert->id]);

        // Follow up tambahan tidak menggeser deadline.
        $this->travel(3)->days();
        $this->as($this->admin)->postJson("/api/v1/admin/alerts/{$alert->id}/follow-ups", [
            'channel' => 'WHATSAPP', 'outcome' => 'DIJAWAB_AKAN_REVIEW',
        ])->assertCreated();
        $this->assertEquals($deadline->timestamp, $alert->fresh()->follow_up_deadline->timestamp);
        $this->assertSame(2, $alert->followUps()->count());

        // Belum lewat deadline.
        $this->sweep();
        $this->assertSame('CLIENT_REVIEW', $milestone->fresh()->status);

        // Deadline lewat -> ESCALATED + AWAITING_DECISION. Tidak ada auto-approve.
        $this->travelTo($deadline);
        $this->sweep();
        $this->assertSame('ESCALATED', $milestone->fresh()->status);
        $this->assertSame('AWAITING_DECISION', $alert->fresh()->status);
        $this->assertNull($milestone->fresh()->approved_at);

        // UMKM tidak bisa review lagi; follow up setelah AWAITING_DECISION ditolak.
        $this->as($this->admin)->postJson("/api/v1/admin/alerts/{$alert->id}/follow-ups", [
            'channel' => 'EMAIL', 'outcome' => 'LAINNYA',
        ])->assertStatus(409);
    }

    public function test_umkm_response_before_deadline_resolves_alert(): void
    {
        [$contract, $milestone] = $this->milestoneIn('CLIENT_REVIEW', ['client_review_started_at' => now()]);
        $submission = $this->submission($milestone, 'PENDING_CLIENT');
        $this->fundEscrow($contract);

        $this->travel(14)->days();
        $this->sweep();
        $alert = AdminAlert::query()->where('type', 'UMKM_UNRESPONSIVE')->sole();
        $this->as($this->admin)->postJson("/api/v1/admin/alerts/{$alert->id}/follow-ups", [
            'channel' => 'WHATSAPP', 'outcome' => 'DIJAWAB_AKAN_REVIEW',
        ])->assertCreated();

        $this->travel(2)->days();
        $this->as($this->umkm)->postJson("/api/v1/submissions/{$submission->id}/client-review", ['decision' => 'APPROVED'])->assertOk();
        $this->assertSame('RESOLVED', $alert->fresh()->status);

        // Job deadline yang sudah terjadwal tidak berbuat apa-apa.
        $this->travel(10)->days();
        $this->runCheck(SchedulerPlanner::FOLLOW_UP_DEADLINE, $alert->id);
        $this->assertSame('APPROVED', $milestone->fresh()->status);
        $this->assertSame('RESOLVED', $alert->fresh()->status);
    }

    public function test_new_review_cycle_restarts_reminders(): void
    {
        [, $milestone] = $this->milestoneIn('CLIENT_REVIEW', ['client_review_started_at' => now()]);

        $this->travel(3)->days();
        $this->sweep();
        $this->assertSame(1, $this->countNotifications($this->umkm, 'REVIEW_REMINDER'));

        // Siklus baru (setelah revisi & mentor approve lagi).
        $milestone->update(['client_review_started_at' => now()]);
        $this->sweep();
        $this->assertSame(1, $this->countNotifications($this->umkm, 'REVIEW_REMINDER'));

        $this->travel(3)->days();
        $this->sweep();
        $this->assertSame(2, $this->countNotifications($this->umkm, 'REVIEW_REMINDER'));
    }

    public function test_timers_are_paused_while_cancellation_is_requested(): void
    {
        [$contract, $milestone] = $this->milestoneIn('CLIENT_REVIEW', ['client_review_started_at' => now()]);
        $contract->update(['status' => 'CANCELLATION_REQUESTED']);

        $this->travel(15)->days();
        $this->sweep();

        $this->assertSame(0, UserNotification::query()->count());
        $this->assertSame(0, AdminAlert::query()->count());
    }

    // ---------------------------------------------------------------- deadline milestone

    public function test_milestone_deadline_reminders_and_overdue_alert(): void
    {
        // Due 2026-10-25 WIB = mulai 2026-10-24 17:00 UTC.
        [, $milestone] = $this->milestoneIn('IN_PROGRESS', ['due_date' => '2026-10-25']);

        $this->travelTo(CarbonImmutable::parse('2026-10-22 16:59:00', 'UTC'));
        $this->sweep();
        $this->assertSame(0, UserNotification::query()->count());

        $this->travelTo(CarbonImmutable::parse('2026-10-22 17:00:00', 'UTC'));
        $this->sweep();
        $this->assertSame(1, $this->countNotifications($this->student, 'MILESTONE_DUE_SOON'));

        $this->travelTo(CarbonImmutable::parse('2026-10-24 17:00:00', 'UTC'));
        $this->sweep();
        $this->sweep();
        $this->assertSame(1, $this->countNotifications($this->student, 'MILESTONE_DUE'));

        $this->travelTo(CarbonImmutable::parse('2026-10-27 17:00:00', 'UTC'));
        $this->sweep();
        $this->assertDatabaseHas('admin_alerts', ['type' => 'STUDENT_OVERDUE', 'reference_id' => $milestone->id]);
    }

    // ---------------------------------------------------------------- undangan & project

    public function test_invitations_expire_and_projects_close_after_deadline(): void
    {
        $project = Project::query()->create([
            'umkm_id' => $this->umkm->id, 'category_id' => $this->project->category_id, 'title' => 'Open',
            'description' => 'x', 'budget_min' => 1, 'budget_max' => 1, 'deadline' => '2026-10-25', 'status' => 'OPEN',
        ]);
        $invitation = Invitation::query()->create([
            'project_id' => $project->id, 'student_id' => $this->student->id, 'status' => 'PENDING', 'expires_at' => now()->addDays(3),
        ]);
        $application = Application::query()->create([
            'project_id' => $project->id, 'student_id' => User::factory()->create(['role' => 'STUDENT'])->id,
            'proposal' => 'x', 'offered_price' => 150000, 'estimated_days' => 1, 'status' => 'PENDING',
        ]);

        $this->travel(3)->days();
        $this->sweep();
        $this->assertSame('EXPIRED', $invitation->fresh()->status);
        $this->assertSame('OPEN', $project->fresh()->status);

        // Deadline 25 Okt WIB berakhir 25 Okt 17:00 UTC.
        $this->travelTo(CarbonImmutable::parse('2026-10-25 16:59:00', 'UTC'));
        $this->sweep();
        $this->assertSame('OPEN', $project->fresh()->status);

        $this->travelTo(CarbonImmutable::parse('2026-10-25 17:00:00', 'UTC'));
        $this->sweep();
        $this->assertSame('CLOSED', $project->fresh()->status);
        $this->assertNotNull($project->fresh()->closed_at);
        $this->assertSame('REJECTED', $application->fresh()->status);
    }

    // ---------------------------------------------------------------- follow up & notifikasi API

    public function test_follow_up_endpoint_rules(): void
    {
        [, $milestone] = $this->milestoneIn('CLIENT_REVIEW', ['client_review_started_at' => now()]);
        $alert = AdminAlert::query()->create(['type' => 'UMKM_UNRESPONSIVE', 'severity' => 'MEDIUM', 'reference_type' => 'MILESTONE', 'reference_id' => $milestone->id, 'status' => 'OPEN']);
        $other = AdminAlert::query()->create(['type' => 'MENTOR_RETURN_LIMIT', 'severity' => 'MEDIUM', 'reference_type' => 'MILESTONE', 'reference_id' => $milestone->id, 'status' => 'OPEN']);
        $url = "/api/v1/admin/alerts/{$alert->id}/follow-ups";

        $this->as($this->umkm)->postJson($url, ['channel' => 'TELEPON', 'outcome' => 'LAINNYA'])->assertStatus(403);
        $this->as($this->admin)->postJson($url, ['channel' => 'FAX', 'outcome' => 'LAINNYA'])->assertStatus(422);
        $this->as($this->admin)->postJson("/api/v1/admin/alerts/{$other->id}/follow-ups", ['channel' => 'TELEPON', 'outcome' => 'LAINNYA'])
            ->assertStatus(422)->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');

        $alert->update(['status' => 'RESOLVED']);
        $this->as($this->admin)->postJson($url, ['channel' => 'TELEPON', 'outcome' => 'LAINNYA'])->assertStatus(409);
    }

    public function test_notification_inbox(): void
    {
        $contract = $this->contract('FUNDED', ['funded_at' => now()]);
        $this->travel(25)->hours();
        $this->sweep();

        $notification = UserNotification::query()->where('user_id', $this->student->id)->sole();
        // Kanal WhatsApp dikirim job (mock log) -> sent_at terisi.
        $this->assertNotNull($notification->sent_at);
        $this->assertSame(['IN_APP', 'WHATSAPP'], $notification->channelList());

        $this->as($this->student)->getJson('/api/v1/notifications?unread=1')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.unread_count', 1)
            ->assertJsonPath('data.0.data.contract_id', $contract->id);

        $this->as($this->umkm)->postJson("/api/v1/notifications/{$notification->id}/read")->assertStatus(404);
        $this->as($this->student)->postJson('/api/v1/notifications/not-a-uuid/read')->assertStatus(404);
        $this->as($this->student)->postJson("/api/v1/notifications/{$notification->id}/read")
            ->assertOk()->assertJsonPath('data.id', $notification->id);
        $this->as($this->student)->getJson('/api/v1/notifications')->assertOk()->assertJsonPath('meta.unread_count', 0);
    }

    // ---------------------------------------------------------------- delayed job dijadwalkan saat event

    public function test_events_schedule_delayed_checks(): void
    {
        [$contract, $milestone] = $this->milestoneIn('MENTOR_REVIEW');
        $submission = $this->submission($milestone, 'PENDING_MENTOR');
        $this->assign($milestone);

        Queue::fake();
        $this->as($this->mentor)->postJson("/api/v1/submissions/{$submission->id}/mentor-review", ['decision' => 'APPROVED'])->assertOk();

        // H+3, H+7, H+10 reminder + H+14 alert.
        Queue::assertPushed(ScheduledCheckJob::class, fn (ScheduledCheckJob $job) => $job->check === SchedulerPlanner::CLIENT_REVIEW
            && $job->entityId === $milestone->id);
        $this->assertCount(4, Queue::pushed(ScheduledCheckJob::class, fn (ScheduledCheckJob $job) => $job->check === SchedulerPlanner::CLIENT_REVIEW));
    }

    // ---------------------------------------------------------------- helper

    private function sweep(): void
    {
        $this->artisan('scheduler:sweep')->assertSuccessful();
    }

    private function runCheck(string $check, string $id): void
    {
        ScheduledCheckJob::dispatchSync($check, $id);
    }

    private function as(User $user): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('t')->plainTextToken);
    }

    private function countNotifications(User $user, string $type): int
    {
        return UserNotification::query()->where('user_id', $user->id)->where('type', $type)->count();
    }

    private function contract(string $status, array $attributes = []): Contract
    {
        return Contract::query()->create([
            'contract_no' => 'CTR-SCHED',
            'project_id' => $this->project->id,
            'umkm_id' => $this->umkm->id,
            'student_id' => $this->student->id,
            'total_amount' => 400000,
            'platform_fee_pct' => 12,
            'mentor_share_pct' => 30,
            'mentor_min_fee' => 10000,
            'status' => $status,
            ...$attributes,
        ]);
    }

    /** @return array{0: Contract, 1: Milestone} */
    private function milestoneIn(string $status, array $attributes = []): array
    {
        $contract = $this->contract('IN_PROGRESS', ['funded_at' => now(), 'started_at' => now()]);
        $milestone = Milestone::query()->create([
            'contract_id' => $contract->id, 'sequence' => 1, 'title' => 'Feed Instagram', 'amount' => 400000,
            'status' => $status, 'max_revisions' => 2, 'max_mentor_returns' => 3, 'started_at' => now(), ...$attributes,
        ]);

        return [$contract, $milestone];
    }

    private function submission(Milestone $milestone, string $status): Submission
    {
        return Submission::query()->create([
            'milestone_id' => $milestone->id, 'version_no' => 1, 'status' => $status, 'submitted_at' => now(),
        ]);
    }

    private function assign(Milestone $milestone): void
    {
        MentorAssignment::query()->create([
            'milestone_id' => $milestone->id, 'mentor_id' => $this->mentor->id, 'status' => 'ACTIVE', 'assigned_at' => now(),
        ]);
        $milestone->update(['mentor_id' => $this->mentor->id]);
    }

    private function fundEscrow(Contract $contract): void
    {
        $escrow = Escrow::query()->create(['contract_id' => $contract->id, 'status' => 'PENDING_FUNDING']);
        $payment = Payment::query()->create([
            'payer_id' => $this->umkm->id, 'purpose' => 'ESCROW_FUNDING', 'reference_type' => 'CONTRACT', 'reference_id' => $contract->id,
            'amount' => $contract->total_amount, 'gateway_fee' => 0, 'gateway' => 'MOCK', 'gateway_ref' => 'MOCK-SCHED', 'status' => 'PAID',
        ]);
        DB::transaction(fn () => app(LedgerService::class)->fundEscrow($escrow, $payment));
    }
}
