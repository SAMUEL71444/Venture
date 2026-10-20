<?php

namespace App\Modules\admin\Services;

use App\Models\PlatformSetting;
use App\Models\User;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * GET/PUT /admin/settings. Hanya key yang terdaftar di README "Nilai di platform_settings".
 * Kontrak berjalan tidak terpengaruh karena fee di-snapshot (01 aturan 6).
 */
final class SettingsService
{
    /** Aturan validasi per key. Rentang komisi 10–15% sesuai aturan bisnis. */
    private const RULES = [
        'platform_fee_pct' => ['numeric', 'between:10,15', 'decimal:0,2'],
        'mentor_share_pct' => ['numeric', 'between:0,100', 'decimal:0,2'],
        'mentor_min_fee' => ['integer', 'min:0'],
        'min_milestone_amount' => ['integer', 'min:1'],
        'max_revisions_per_milestone' => ['integer', 'min:0', 'max:10'],
        'max_mentor_returns_per_milestone' => ['integer', 'min:1', 'max:10'],
        'max_active_contracts_per_student' => ['integer', 'min:1', 'max:10'],
        'min_withdrawal_amount' => ['integer', 'min:1'],
        'withdrawal_fee' => ['nullable', 'integer', 'min:0'],
        'premium_listing_price' => ['integer', 'min:0'],
        'premium_listing_days' => ['integer', 'min:1'],
        'payment_expiry_hours' => ['integer', 'min:1', 'max:168'],
        'start_reminder_hours' => ['array', 'min:1'],
        'start_reminder_hours.*' => ['integer', 'min:1'],
        'student_not_started_alert_days' => ['integer', 'min:1'],
        'mentor_sla_hours' => ['integer', 'min:1'],
        'mentor_overdue_alert_hours' => ['integer', 'min:1'],
        'umkm_review_reminder_days' => ['array', 'min:1'],
        'umkm_review_reminder_days.*' => ['integer', 'min:1'],
        'umkm_unresponsive_alert_days' => ['integer', 'min:1'],
        'umkm_followup_deadline_days' => ['integer', 'min:1'],
        'admin_followup_sla_days' => ['integer', 'min:1'],
        'cancellation_response_days' => ['integer', 'min:1'],
        'invitation_expiry_days' => ['integer', 'min:1'],
        'matching_default_rating' => ['numeric', 'between:0,5'],
        'milestone_due_reminder_days_before' => ['integer', 'min:0'],
        'student_overdue_alert_days' => ['integer', 'min:1'],
        'premium_reminder_days_before' => ['integer', 'min:1'],
    ];

    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly PlatformSettingsService $settings,
        private readonly AuditLogger $audit,
    ) {}

    public function all(): array
    {
        return PlatformSetting::query()->orderBy('key')->get()
            ->mapWithKeys(fn (PlatformSetting $setting) => [$setting->key => $setting->value])->all();
    }

    /** @param  array<string, mixed>  $values */
    public function update(array $values, User $admin, ?string $ip = null): array
    {
        $unknown = array_diff(array_keys($values), array_filter(array_keys(self::RULES), fn ($key) => ! str_contains($key, '.')));
        if ($values === [] || $unknown !== []) {
            throw ValidationException::withMessages(['settings' => $values === [] ? 'No settings given.' : 'Unknown setting key(s): '.implode(', ', $unknown)]);
        }

        $rules = array_filter(self::RULES, fn ($key) => array_key_exists(strtok($key, '.'), $values), ARRAY_FILTER_USE_KEY);
        $rules = array_map(fn (array $rule) => in_array('nullable', $rule, true) ? $rule : ['required', ...$rule], $rules);
        Validator::make($values, $rules)->validate();

        // mentor_overdue_alert_hours harus setelah mentor_sla_hours.
        $sla = $values['mentor_sla_hours'] ?? $this->settings->get('mentor_sla_hours');
        $overdue = $values['mentor_overdue_alert_hours'] ?? $this->settings->get('mentor_overdue_alert_hours');
        if ($sla !== null && $overdue !== null && (int) $overdue <= (int) $sla) {
            throw ValidationException::withMessages(['mentor_overdue_alert_hours' => 'Must be greater than mentor_sla_hours.']);
        }

        $this->transactions->run(function () use ($values, $admin, $ip) {
            $before = PlatformSetting::query()->whereIn('key', array_keys($values))->lockForUpdate()->get()
                ->mapWithKeys(fn (PlatformSetting $setting) => [$setting->key => $setting->value])->all();

            foreach ($values as $key => $value) {
                $normalized = is_array($value) ? array_values(array_map('intval', $value)) : $this->normalize($value);
                PlatformSetting::query()->updateOrCreate(['key' => $key], ['value' => $normalized]);
            }

            // platform_settings memakai key string; entity_id audit (uuid) diisi nil UUID.
            $this->audit->logRaw($admin, 'PLATFORM_SETTINGS_UPDATED', PlatformSetting::class, '00000000-0000-0000-0000-000000000000', $before, $values, $ip);
        });

        $this->settings->clearCache();

        return $this->all();
    }

    private function normalize(mixed $value): int|float|null
    {
        if ($value === null) {
            return null;
        }

        return is_numeric($value) && (string) (int) $value === (string) $value ? (int) $value : (float) $value;
    }
}
