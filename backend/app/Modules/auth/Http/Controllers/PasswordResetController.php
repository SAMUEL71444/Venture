<?php

namespace App\Modules\auth\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\auth\Http\Controllers\Concerns\ResolvesOtpTarget;
use App\Modules\auth\Services\OtpService;
use App\Modules\auth\Services\RefreshTokenService;
use App\Shared\Audit\AuditLogger;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Lupa password lewat OTP email / WhatsApp:
 * kirim OTP -> verifikasi (dapat reset_token, 15 menit, sekali pakai) -> set password baru.
 */
final class PasswordResetController extends Controller
{
    use ResolvesOtpTarget;

    public function sendOtp(Request $request, OtpService $otpService)
    {
        [$channel, $identifier] = $this->validateOtpTarget($request);

        // Respons selalu sama, terdaftar atau tidak (anti-enumerasi).
        return ApiResponse::success(
            $otpService->send($identifier, $channel, OtpService::PURPOSE_PASSWORD_RESET),
            [],
            202,
        );
    }

    public function verifyOtp(Request $request, OtpService $otpService)
    {
        [$channel, $identifier, $input] = $this->validateOtpTarget($request, [
            'code' => ['required', 'digits:6'],
        ]);

        $result = $otpService->verify($identifier, $input['code'], $channel, OtpService::PURPOSE_PASSWORD_RESET);

        return ApiResponse::success([
            'reset_token' => $result['verification_token'],
            'expires_in_seconds' => $result['expires_in_seconds'],
        ]);
    }

    public function reset(
        Request $request,
        OtpService $otpService,
        RefreshTokenService $tokens,
        AuditLogger $audit,
    ) {
        [$channel, $identifier, $input] = $this->validateOtpTarget($request, [
            'reset_token' => ['required', 'string', 'min:64'],
            // Aturan sama dengan registrasi.
            'password' => ['required', 'string', 'min:8', 'max:128', 'confirmed'],
        ]);

        $outcome = DB::transaction(function () use ($channel, $identifier, $input, $otpService, $tokens, $audit, $request) {
            // Token dikonsumsi lebih dulu: status akun hanya terlihat oleh pemilik OTP yang sah.
            $otpService->consumeProof($identifier, $input['reset_token'], $channel, OtpService::PURPOSE_PASSWORD_RESET);

            $user = User::query()
                ->where(OtpService::userColumn($channel), $identifier)
                ->lockForUpdate()
                ->first();

            if (! $user) {
                throw new BusinessRuleViolation('Password reset session is invalid or expired.', [], 'RESET_TOKEN_INVALID');
            }

            if ($user->status === 'SUSPENDED') {
                return 'suspended';
            }

            $user->password_hash = $input['password'];
            $user->save();

            // Semua sesi lama (refresh token + personal access token) dicabut.
            $tokens->revokeAllSessions($user);
            $audit->logRaw(null, 'PASSWORD_RESET', User::class, $user->id, null, ['channel' => $channel], $request->ip());

            return 'reset';
        });

        if ($outcome === 'suspended') {
            return ApiResponse::error('ACCOUNT_SUSPENDED', 'This account is suspended.', null, 403);
        }

        return ApiResponse::success(['password_reset' => true]);
    }
}
