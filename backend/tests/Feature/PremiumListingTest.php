<?php

use App\Models\LedgerTransaction;
use App\Models\Payment;
use App\Models\PremiumListing;
use App\Models\Project;
use App\Models\ServiceCategory;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\Wallet;
use App\Modules\payment\Gateway\PaymentGateway;
use Carbon\CarbonImmutable;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Fase 7 — premium listing Rp 50.000 / 30 hari.
 * Acuan: README aturan 15, ERD PREMIUM_LISTINGS, 07 (premium-reminder, premium-expire), 08 (POST /projects/{id}/premium).
 */
class PremiumListingTest extends TestCase
{
    use RefreshDatabase;

    private User $umkm;

    private Project $premiumProject;

    private Project $regularProject;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-20 03:00:00', 'UTC'));
        $this->seed(PlatformSettingsSeeder::class);

        $this->umkm = User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']);
        $category = ServiceCategory::query()->create(['name' => 'Branding', 'slug' => 'branding']);
        $make = fn (string $title, $publishedAt) => Project::query()->create([
            'umkm_id' => $this->umkm->id, 'category_id' => $category->id, 'title' => $title, 'description' => 'x',
            'budget_min' => 1, 'budget_max' => 1, 'deadline' => now()->addMonths(3)->toDateString(), 'status' => 'OPEN', 'published_at' => $publishedAt,
        ]);
        $this->premiumProject = $make('Premium lama', now()->subDays(5));
        $this->regularProject = $make('Reguler baru', now());
    }

    public function test_purchase_activates_listing_and_records_platform_revenue(): void
    {
        $data = $this->purchase()->assertCreated()
            ->assertJsonPath('data.premium_listing.status', 'PENDING_PAYMENT')
            ->assertJsonPath('data.premium_listing.price', 50000)
            ->assertJsonPath('data.premium_listing.duration_days', 30)
            ->assertJsonPath('data.payment.amount', 50000)
            ->assertJsonPath('data.payment.gateway_fee', 4000)
            ->json('data');
        $this->purchase()->assertOk()->assertJsonPath('data.payment.id', $data['payment']['id']);

        $this->pay($data['payment'])->assertOk()->assertJsonPath('data.status', 'PAID');

        $listing = PremiumListing::query()->find($data['premium_listing']['id']);
        $this->assertSame('ACTIVE', $listing->status);
        $this->assertEquals(now()->addDays(30)->timestamp, $listing->ends_at->timestamp);
        $this->assertSame(1, LedgerTransaction::query()->where('type', 'PREMIUM_LISTING')->count());
        $this->assertSame(50000, (int) Wallet::query()->whereNull('user_id')->where('type', 'PLATFORM_REVENUE')->value('balance'));

        // Project premium tampil lebih dulu walau lebih lama dipublikasikan.
        $student = User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']);
        $this->as($student)->getJson('/api/v1/projects')->assertOk()
            ->assertJsonPath('data.0.id', $this->premiumProject->id)->assertJsonPath('data.0.is_premium', true)
            ->assertJsonPath('data.1.id', $this->regularProject->id);
    }

    public function test_purchase_rules(): void
    {
        $this->as(User::factory()->create(['role' => 'UMKM', 'status' => 'ACTIVE']))
            ->postJson("/api/v1/projects/{$this->premiumProject->id}/premium", ['method' => 'VA'])->assertStatus(403);
        $this->premiumProject->update(['status' => 'DRAFT']);
        $this->purchase()->assertStatus(409);
        $this->purchase('CASH')->assertStatus(422);
    }

    public function test_extension_starts_after_current_period(): void
    {
        $first = $this->purchase()->json('data');
        $this->pay($first['payment']);

        $this->travel(20)->days();
        $second = $this->purchase()->assertCreated()->json('data');
        $this->pay($second['payment']);

        $firstEnds = PremiumListing::query()->find($first['premium_listing']['id'])->ends_at;
        $extension = PremiumListing::query()->find($second['premium_listing']['id']);
        $this->assertEquals($firstEnds->timestamp, $extension->starts_at->timestamp);
        $this->assertEquals($firstEnds->addDays(30)->timestamp, $extension->ends_at->timestamp);
    }

    public function test_reminder_and_expiry_jobs(): void
    {
        $data = $this->purchase()->json('data');
        $this->pay($data['payment']);

        $this->travel(27)->days();
        $this->artisan('scheduler:sweep')->assertSuccessful();
        $this->artisan('scheduler:sweep')->assertSuccessful();
        $this->assertSame(1, UserNotification::query()->where('type', 'PREMIUM_EXPIRING')->count());

        $this->travel(3)->days();
        $this->artisan('scheduler:sweep')->assertSuccessful();
        $this->assertSame('EXPIRED', PremiumListing::query()->find($data['premium_listing']['id'])->status);
        $this->assertSame(1, UserNotification::query()->where('type', 'PREMIUM_EXPIRED')->count());

        $this->as(User::factory()->create(['role' => 'STUDENT', 'status' => 'ACTIVE']))->getJson('/api/v1/projects')
            ->assertJsonPath('data.0.id', $this->regularProject->id);
    }

    public function test_unpaid_bill_expires_and_late_payment_is_refunded(): void
    {
        $data = $this->purchase()->json('data');

        $this->travel(25)->hours();
        $this->artisan('payments:expire-overdue')->assertSuccessful();
        $this->assertSame('EXPIRED', PremiumListing::query()->find($data['premium_listing']['id'])->status);
        $this->assertSame('EXPIRED', Payment::query()->find($data['payment']['id'])->status);

        $this->pay($data['payment'])->assertOk();
        $this->assertDatabaseHas('refunds', ['payment_id' => $data['payment']['id'], 'amount' => 50000, 'status' => 'SUCCESS']);
        $this->assertSame(0, LedgerTransaction::query()->where('type', 'PREMIUM_LISTING')->count());
    }

    private function purchase(string $method = 'VA'): TestResponse
    {
        return $this->as($this->umkm)->postJson("/api/v1/projects/{$this->premiumProject->id}/premium", ['method' => $method]);
    }

    private function pay(array $payment): TestResponse
    {
        $raw = json_encode(['gateway_ref' => $payment['gateway_ref'], 'status' => 'PAID', 'gross_amount' => $payment['total_charged']]);

        return $this->call('POST', '/api/v1/webhooks/payment-gateway', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_SIGNATURE' => app(PaymentGateway::class)->sign($raw),
        ], $raw);
    }

    private function as(User $user): self
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('t')->plainTextToken);
    }
}
