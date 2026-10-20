<?php

use App\Shared\Settings\PlatformSettingsService;
use Database\Seeders\PlatformSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeds_the_documented_business_settings_and_serves_them_through_the_cache_service(): void
    {
        $this->seed(PlatformSettingsSeeder::class);

        $settings = app(PlatformSettingsService::class);

        expect($settings->get('platform_fee_pct'))->toBe(12)
            ->and($settings->get('start_reminder_hours'))->toBe([24, 72])
            ->and($settings->get('withdrawal_fee'))->toBeNull()
            ->and($settings->get('unknown_setting', 'fallback'))->toBe('fallback')
            ->and($settings->all())->toHaveCount(26);
    }
}
