<?php

namespace Database\Seeders;

use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PlatformSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $values = [
            'platform_fee_pct' => 12,
            'mentor_share_pct' => 30,
            'mentor_min_fee' => 10000,
            'min_milestone_amount' => 150000,
            'max_revisions_per_milestone' => 2,
            'max_mentor_returns_per_milestone' => 3,
            'max_active_contracts_per_student' => 2,
            'min_withdrawal_amount' => 20000,
            'withdrawal_fee' => null,
            'premium_listing_price' => 50000,
            'premium_listing_days' => 30,
            'payment_expiry_hours' => 24,
            'start_reminder_hours' => [24, 72],
            'student_not_started_alert_days' => 7,
            'mentor_sla_hours' => 48,
            'umkm_review_reminder_days' => [3, 7, 10],
            'umkm_unresponsive_alert_days' => 14,
            'umkm_followup_deadline_days' => 7,
            'admin_followup_sla_days' => 2,
            'cancellation_response_days' => 3,
            'invitation_expiry_days' => 3,
            'matching_default_rating' => 3.5,
            'mentor_overdue_alert_hours' => 72,
            'milestone_due_reminder_days_before' => 2,
            'student_overdue_alert_days' => 3,
            'premium_reminder_days_before' => 3,
        ];

        $now = now();
        $rows = [];

        foreach ($values as $key => $value) {
            $rows[] = [
                'key' => $key,
                'value' => json_encode($value, JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('platform_settings')->upsert($rows, ['key'], ['value', 'updated_at']);

        app(PlatformSettingsService::class)->clearCache();
    }
}
