<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\StudentProfile;
use App\Models\University;
use App\Models\User;
use App\Modules\chat\Events\MessageSent;
use App\Modules\chat\Services\ChatService;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/**
 * Fase 7 — chat UMKM <-> mahasiswa (ERD CONVERSATIONS/MESSAGES, 08 Chat).
 */
class ChatTest extends TestCase
{
    use RefreshDatabase;

    private User $umkm;

    private User $student;

    private Project $project;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PlatformSettingsSeeder::class);

        $this->umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $this->student = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $category = ServiceCategory::query()->create(['name' => 'Branding', 'slug' => 'branding']);
        $university = University::query()->create(['name' => 'Kampus', 'email_domain' => 'kampus.ac.id', 'city' => 'Bandung']);
        StudentProfile::query()->create(['user_id' => $this->student->id, 'university_id' => $university->id, 'verification_status' => 'VERIFIED'])
            ->skills()->attach($category->id, ['level' => 'ADVANCED']);
        $this->project = Project::query()->create([
            'umkm_id' => $this->umkm->id, 'category_id' => $category->id, 'title' => 'Logo', 'description' => 'x',
            'budget_min' => 150000, 'budget_max' => 500000, 'deadline' => now()->addMonth()->toDateString(), 'status' => 'OPEN',
        ]);
    }

    public function test_application_opens_conversation_and_acceptance_links_contract(): void
    {
        $applicationId = $this->apply()->assertCreated()->json('data.id');
        $conversation = Conversation::query()->sole();
        $this->assertSame([$this->umkm->id, $this->student->id, null], [$conversation->umkm_user_id, $conversation->student_user_id, $conversation->contract_id]);

        $contractId = $this->as($this->umkm)->postJson("/api/v1/applications/{$applicationId}/accept")->json('data.contract.id');
        $this->assertSame($contractId, $conversation->fresh()->contract_id);
        $this->assertSame(1, Conversation::query()->count());
    }

    public function test_participants_exchange_messages_with_read_tracking(): void
    {
        Event::fake([MessageSent::class]);
        $this->apply();
        $conversation = Conversation::query()->sole();
        $url = "/api/v1/conversations/{$conversation->id}/messages";

        $this->as($this->umkm)->postJson($url, ['body' => 'Halo, bisa mulai minggu depan?'])
            ->assertCreated()->assertJsonPath('data.is_flagged', false)->assertJsonPath('meta.warning', null);
        Event::assertDispatched(MessageSent::class, fn (MessageSent $event) => $event->broadcastOn()[0]->name === "private-conversation.{$conversation->id}");

        $this->as($this->student)->getJson('/api/v1/conversations')->assertOk()
            ->assertJsonPath('data.0.id', $conversation->id)->assertJsonPath('data.0.unread_count', 1);
        $this->as($this->student)->getJson($url)->assertOk()->assertJsonCount(1, 'data');
        $this->assertNotNull(Message::query()->sole()->read_at);
        $this->as($this->student)->getJson('/api/v1/conversations')->assertJsonPath('data.0.unread_count', 0);

        $outsider = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $this->as($outsider)->getJson($url)->assertStatus(403);
        $this->as($outsider)->postJson($url, ['body' => 'hai'])->assertStatus(403);
        $this->as($this->umkm)->postJson($url, ['body' => ''])->assertStatus(422);
    }

    public function test_off_platform_contact_is_flagged(): void
    {
        $this->apply();
        $conversation = Conversation::query()->sole();

        $this->as($this->student)->postJson("/api/v1/conversations/{$conversation->id}/messages", ['body' => 'WA saya 0812-3456-7890 ya kak'])
            ->assertCreated()->assertJsonPath('data.is_flagged', true)->assertJsonPath('meta.warning', fn ($w) => str_contains($w, 'escrow'));
    }

    public function test_suspicious_message_detection(): void
    {
        foreach (['Hubungi +62 812 3456 7890', 'email saya budi@example.com', 'chat di wa.me/628123', 'Transfer langsung aja kak', 'kirim ke no rek BCA'] as $text) {
            $this->assertTrue(ChatService::isSuspicious($text), $text);
        }
        foreach (['Revisi logo warna biru ya', 'Milestone 2 tanggal 12 selesai', 'Harga 150000 sudah termasuk'] as $text) {
            $this->assertFalse(ChatService::isSuspicious($text), $text);
        }
    }

    private function apply()
    {
        return $this->as($this->student)->postJson("/api/v1/projects/{$this->project->id}/applications", [
            'proposal' => 'Saya siap', 'offered_price' => 300000, 'estimated_days' => 7,
            'proposed_milestones' => [['title' => 'Logo', 'amount' => 300000, 'due_date' => now()->addDays(7)->toDateString()]],
        ]);
    }

    private function as(User $user): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('t')->plainTextToken);
    }
}
