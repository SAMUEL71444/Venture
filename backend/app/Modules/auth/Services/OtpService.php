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

final class OtpService
{
    private const PURPOSE = 'REGISTER';

    public function __construct(private readonly MetaWhatsAppOtpSender $sender) {}

    public function send(string $phone): array
    {
        if (User::query()->where('phone', $phone)->exists()) {
            throw new BusinessRuleViolation('This phone number is already registered.');
        }

        $cooldown = (int) config('auth.otp_resend_cooldown_seconds', 60);
        $recentCode = OtpCode::query()
            ->where('phone', $phone)
            ->where('purpose', self::PURPOSE)
            ->where('created_at', '>=', now()->subSeconds($cooldown))
            ->exists();

        if ($recentCode) {
            throw new BusinessRuleViolation('Please wait before requesting another OTP.', [
                'retry_after_seconds' => $cooldown,
            ]);
        }

        $code = (string) random_int(100000, 999999);
        $otp = OtpCode::query()->create([
            'phone' => $phone,
            'code_hash' => Hash::make($code),
            'purpose' => self::PURPOSE,
            'expires_at' => now()->addMinutes((int) config('auth.otp_ttl_minutes', 5)),
        ]);

        try {
            $this->sender->send($phone, $code);
        } catch (Throwable $exception) {
            $otp->delete();
            report($exception);

            throw new ServiceUnavailableHttpException(null, 'OTP delivery is temporarily unavailable.');
        }

        return [
            'expires_at' => $otp->expires_at->toIso8601String(),
            'resend_after_seconds' => $cooldown,
        ];
    }

    public function verify(string $phone, string $code): array
    {
        $result = DB::transaction(function () use ($phone, $code) {
            $otp = OtpCode::query()
                ->where('phone', $phone)
                ->where('purpose', self::PURPOSE)
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
            $otp->verification_expires_at = now()->addMinutes((int) config('auth.otp_ttl_minutes', 5));
            $otp->save();

            return ['verification_token' => $verificationToken];
        });

        if (isset($result['error'])) {
            $details = $result['error'] === 'invalid'
                ? ['attempts_remaining' => max(0, (int) config('auth.otp_max_attempts', 5) - $this->latestAttempts($phone))]
                : [];

            throw new BusinessRuleViolation(match ($result['error']) {
                'attempt_limit' => 'OTP attempt limit reached. Request a new code.',
                'expired' => 'OTP is invalid or expired.',
                default => 'OTP is invalid or expired.',
            }, $details);
        }

        return [
            'verification_token' => $result['verification_token'],
            'expires_in_seconds' => (int) config('auth.otp_ttl_minutes', 5) * 60,
        ];
    }

    public function consumeRegistrationProof(string $phone, string $verificationToken): OtpCode
    {
        $otp = OtpCode::query()
            ->where('phone', $phone)
            ->where('purpose', self::PURPOSE)
            ->where('verification_token_hash', hash('sha256', $verificationToken))
            ->whereNotNull('verified_at')
            ->where('verification_expires_at', '>', now())
            ->lockForUpdate()
            ->first();

        if (! $otp) {
            throw new BusinessRuleViolation('Phone verification is missing or expired.');
        }

        $otp->verification_token_hash = null;
        $otp->save();

        return $otp;
    }

    private function latestAttempts(string $phone): int
    {
        return (int) OtpCode::query()
            ->where('phone', $phone)
            ->where('purpose', self::PURPOSE)
            ->latest('created_at')
            ->value('attempt_count');
    }
}
