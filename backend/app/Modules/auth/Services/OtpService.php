<?php

namespace App\Modules\auth\Services;

use App\Models\OtpCode;
use App\Models\User;
use App\Shared\Exceptions\BusinessRuleViolation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;
use Throwable;

/**
 * OTP multi-kanal (email / WhatsApp) untuk registrasi dan reset password.
 * `identifier` = email huruf kecil atau nomor E.164. Bila `$channel` null,
 * kanal ditebak dari identifier (mengandung "@" = email).
 */
final class OtpService
{
    public const CHANNEL_EMAIL = 'email';

    public const CHANNEL_WHATSAPP = 'whatsapp';

    public const CHANNELS = [self::CHANNEL_EMAIL, self::CHANNEL_WHATSAPP];

    public const PURPOSE_REGISTER = 'REGISTER';

    public const PURPOSE_PASSWORD_RESET = 'PASSWORD_RESET';

    public const PHONE_PATTERN = '/^\+[1-9][0-9]{7,14}$/';

    public function __construct(private readonly OtpDelivery $delivery) {}

    public static function channelFor(string $identifier): string
    {
        return str_contains($identifier, '@') ? self::CHANNEL_EMAIL : self::CHANNEL_WHATSAPP;
    }

    public static function normalize(string $channel, string $identifier): string
    {
        return $channel === self::CHANNEL_EMAIL ? Str::lower(trim($identifier)) : trim($identifier);
    }

    /** Kolom tabel users yang menyimpan identifier untuk kanal ini. */
    public static function userColumn(string $channel): string
    {
        return $channel === self::CHANNEL_EMAIL ? 'email' : 'phone';
    }

    public function send(string $identifier, ?string $channel = null, string $purpose = self::PURPOSE_REGISTER): array
    {
        [$channel, $identifier] = $this->target($identifier, $channel);
        $cooldown = (int) config('auth.otp_resend_cooldown_seconds', 60);
        $ttl = (int) config('auth.otp_ttl_minutes', 5);
        $isReset = $purpose === self::PURPOSE_PASSWORD_RESET;
        // Reset password: respons selalu sama, baik akun ada atau tidak (anti-enumerasi).
        $generic = [
            'expires_at' => now()->addMinutes($ttl)->toIso8601String(),
            'resend_after_seconds' => $cooldown,
        ];

        $user = $this->findUser($channel, $identifier);

        if ($isReset) {
            if (! $user || $user->status === 'SUSPENDED' || $this->hasRecentCode($channel, $identifier, $purpose, $cooldown)) {
                return $generic;
            }
        } else {
            if ($user) {
                throw new BusinessRuleViolation($channel === self::CHANNEL_EMAIL
                    ? 'This email is already registered.'
                    : 'This phone number is already registered.');
            }

            if ($this->hasRecentCode($channel, $identifier, $purpose, $cooldown)) {
                throw new BusinessRuleViolation('Please wait before requesting another OTP.', [
                    'retry_after_seconds' => $cooldown,
                ]);
            }
        }

        $code = (string) random_int(100000, 999999);
        $otp = OtpCode::query()->create([
            'channel' => $channel,
            'identifier' => $identifier,
            'phone' => $channel === self::CHANNEL_WHATSAPP ? $identifier : null,
            'code_hash' => Hash::make($code),
            'purpose' => $purpose,
            'expires_at' => now()->addMinutes($ttl),
        ]);

        try {
            $this->delivery->send($channel, $identifier, $code, $purpose);
        } catch (Throwable $exception) {
            $otp->delete();
            report($exception);

            if ($isReset) {
                // Galat pengiriman hanya terjadi untuk akun yang ada; jangan bocorkan lewat respons.
                return $generic;
            }

            throw new ServiceUnavailableHttpException(null, 'OTP delivery is temporarily unavailable.');
        }

        return $isReset ? $generic : [
            'expires_at' => $otp->expires_at->toIso8601String(),
            'resend_after_seconds' => $cooldown,
        ];
    }

    public function verify(string $identifier, string $code, ?string $channel = null, string $purpose = self::PURPOSE_REGISTER): array
    {
        [$channel, $identifier] = $this->target($identifier, $channel);
        $isReset = $purpose === self::PURPOSE_PASSWORD_RESET;
        $tokenTtl = $isReset
            ? (int) config('auth.password_reset_token_ttl_minutes', 15)
            : (int) config('auth.otp_ttl_minutes', 5);

        $result = DB::transaction(function () use ($channel, $identifier, $code, $purpose, $tokenTtl) {
            $otp = OtpCode::query()
                ->where('channel', $channel)
                ->where('identifier', $identifier)
                ->where('purpose', $purpose)
                ->whereNull('used_at')
                ->where('expires_at', '>', now())
                ->latest('created_at')
                ->lockForUpdate()
                ->first();

            if (! $otp) {
                return ['error' => 'expired'];
            }

            $maxAttempts = (int) config('auth.otp_max_attempts', 5);
            $otp->attempt_count++;

            if (! Hash::check($code, $otp->code_hash)) {
                if ($otp->attempt_count >= $maxAttempts) {
                    $otp->used_at = now();
                }

                $otp->save();

                return ['error' => $otp->used_at ? 'attempt_limit' : 'invalid'];
            }

            $verificationToken = Str::random(64);
            $otp->used_at = now();
            $otp->verified_at = now();
            $otp->verification_token_hash = hash('sha256', $verificationToken);
            $otp->verification_expires_at = now()->addMinutes($tokenTtl);
            $otp->save();

            return ['verification_token' => $verificationToken];
        });

        if (isset($result['error'])) {
            if ($isReset) {
                // Pesan seragam: sisa percobaan akan membocorkan bahwa akun itu ada.
                throw new BusinessRuleViolation('The verification code is invalid or expired.');
            }

            $details = $result['error'] === 'invalid'
                ? ['attempts_remaining' => max(0, (int) config('auth.otp_max_attempts', 5) - $this->latestAttempts($channel, $identifier, $purpose))]
                : [];

            throw new BusinessRuleViolation(match ($result['error']) {
                'attempt_limit' => 'OTP attempt limit reached. Request a new code.',
                'expired' => 'OTP is invalid or expired.',
                default => 'OTP is invalid or expired.',
            }, $details);
        }

        return [
            'verification_token' => $result['verification_token'],
            'expires_in_seconds' => $tokenTtl * 60,
        ];
    }

    /**
     * Tukarkan token verifikasi (sekali pakai) yang terikat ke kanal + identifier + tujuan.
     * Harus dipanggil di dalam transaksi.
     */
    public function consumeProof(string $identifier, string $verificationToken, ?string $channel = null, string $purpose = self::PURPOSE_REGISTER): OtpCode
    {
        [$channel, $identifier] = $this->target($identifier, $channel);

        $otp = OtpCode::query()
            ->where('channel', $channel)
            ->where('identifier', $identifier)
            ->where('purpose', $purpose)
            ->where('verification_token_hash', hash('sha256', $verificationToken))
            ->whereNotNull('verified_at')
            ->where('verification_expires_at', '>', now())
            ->lockForUpdate()
            ->first();

        if (! $otp) {
            throw new BusinessRuleViolation(match (true) {
                $purpose === self::PURPOSE_PASSWORD_RESET => 'Password reset session is invalid or expired.',
                $channel === self::CHANNEL_EMAIL => 'Email verification is missing or expired.',
                default => 'Phone verification is missing or expired.',
            });
        }

        $otp->verification_token_hash = null;
        $otp->save();

        return $otp;
    }

    public function consumeRegistrationProof(string $identifier, string $verificationToken, ?string $channel = null): OtpCode
    {
        return $this->consumeProof($identifier, $verificationToken, $channel, self::PURPOSE_REGISTER);
    }

    public function findUser(string $channel, string $identifier): ?User
    {
        return User::query()->where(self::userColumn($channel), $identifier)->first();
    }

    /** @return array{0: string, 1: string} */
    private function target(string $identifier, ?string $channel): array
    {
        $channel ??= self::channelFor($identifier);

        return [$channel, self::normalize($channel, $identifier)];
    }

    private function hasRecentCode(string $channel, string $identifier, string $purpose, int $cooldown): bool
    {
        return OtpCode::query()
            ->where('channel', $channel)
            ->where('identifier', $identifier)
            ->where('purpose', $purpose)
            ->where('created_at', '>=', now()->subSeconds($cooldown))
            ->exists();
    }

    private function latestAttempts(string $channel, string $identifier, string $purpose): int
    {
        return (int) OtpCode::query()
            ->where('channel', $channel)
            ->where('identifier', $identifier)
            ->where('purpose', $purpose)
            ->latest('created_at')
            ->value('attempt_count');
    }
}
