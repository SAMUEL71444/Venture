<?php

namespace App\Modules\auth\Services;

use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Pengirim OTP untuk pengembangan lokal: kode ditulis ke storage/logs/laravel.log
 * agar alur email/WhatsApp bisa diuji tanpa kredensial. Hanya dipakai saat APP_ENV=local.
 */
final class LogOtpSender
{
    public function send(string $channel, string $identifier, string $code, string $purpose): void
    {
        if (! app()->environment('local')) {
            // Kode OTP tidak boleh pernah tertulis ke log di luar lingkungan lokal.
            throw new RuntimeException('LogOtpSender may only be used when APP_ENV=local.');
        }

        Log::info("[OTP lokal] {$channel} {$identifier} ({$purpose}): {$code}");
    }
}
