<?php

namespace App\Shared\Settings;

use App\Models\PlatformSetting;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

final class PlatformSettingsService
{
    private const CACHE_KEY = 'platform_settings:all';

    public function get(string $key, mixed $default = null): mixed
    {
        $settings = $this->all();

        return array_key_exists($key, $settings) ? $settings[$key] : $default;
    }

    /**
     * Angka bisnis wajib ada di platform_settings. Jika tidak ada, gagal keras
     * daripada diam-diam memakai nilai yang salah (misal komisi).
     */
    public function int(string $key): int
    {
        return (int) $this->required($key);
    }

    public function number(string $key): float
    {
        return (float) $this->required($key);
    }

    /**
     * Setting berupa daftar angka, misal umkm_review_reminder_days = [3, 7, 10].
     *
     * @return list<int>
     */
    public function intList(string $key): array
    {
        $value = $this->get($key);
        $list = is_array($value) ? $value : [$value];

        if ($list === [] || array_filter($list, fn ($item) => ! is_numeric($item)) !== []) {
            throw new RuntimeException("Platform setting [{$key}] must be a list of numbers.");
        }

        $ints = array_map('intval', $list);
        sort($ints);

        return array_values($ints);
    }

    public function all(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, fn () => PlatformSetting::query()
            ->get()
            ->mapWithKeys(fn (PlatformSetting $setting) => [$setting->key => $setting->value])
            ->all());
    }

    public function clearCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function required(string $key): int|float|string
    {
        $value = $this->get($key);

        if (! is_numeric($value)) {
            throw new RuntimeException("Platform setting [{$key}] is missing or not numeric.");
        }

        return $value;
    }
}
