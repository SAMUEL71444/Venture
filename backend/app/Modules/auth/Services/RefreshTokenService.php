<?php

namespace App\Modules\auth\Services;

use App\Models\RefreshToken;
use App\Models\User;
use App\Shared\Audit\AuditLogger;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

final class RefreshTokenService
{
    public function issue(User $user): array
    {
        $accessToken = $user->createToken(
            'api-access',
            ['*'],
            now()->addMinutes((int) config('sanctum.expiration', 15)),
        );
        $refreshToken = Str::random(96);
        $refreshRecord = RefreshToken::query()->create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $refreshToken),
            'expires_at' => now()->addDays((int) config('auth.refresh_token_ttl_days', 30)),
        ]);

        return [
            'token_type' => 'Bearer',
            'access_token' => $accessToken->plainTextToken,
            'access_token_expires_at' => $accessToken->accessToken->expires_at?->toIso8601String(),
            'refresh_token' => $refreshToken,
            'refresh_token_expires_at' => $refreshRecord->expires_at->toIso8601String(),
        ];
    }

    public function __construct(private readonly AuditLogger $audit) {}

    public function rotate(string $plainTextToken): array
    {
        // Pencabutan sesi saat reuse harus tersimpan (commit) sebelum 401 dikembalikan.
        $tokens = DB::transaction(function () use ($plainTextToken) {
            $record = RefreshToken::query()
                ->where('token_hash', hash('sha256', $plainTextToken))
                ->lockForUpdate()
                ->first();

            if ($record && $record->revoked_at && $record->replaced_by_id) {
                // Token yang sudah dirotasi dipakai lagi = indikasi token dicuri (audit F7).
                // Cabut seluruh sesi user: semua refresh token + access token.
                $this->revokeAllSessions($record->user);
                $this->audit->logRaw(null, 'REFRESH_TOKEN_REUSE_DETECTED', User::class, $record->user_id, null, [
                    'refresh_token_id' => $record->id,
                ]);

                return null;
            }

            if (! $record || $record->revoked_at || $record->expires_at->isPast()) {
                throw new AuthenticationException('Refresh token is invalid or expired.');
            }

            if ($record->user->status === 'SUSPENDED') {
                throw new AuthenticationException('This account is suspended.');
            }

            $record->revoked_at = now();
            $record->save();

            $tokens = $this->issue($record->user);
            $replacementId = RefreshToken::query()
                ->where('token_hash', hash('sha256', $tokens['refresh_token']))
                ->value('id');

            $record->replaced_by_id = $replacementId;
            $record->save();

            return $tokens;
        });

        if ($tokens === null) {
            throw new AuthenticationException('Refresh token is invalid or expired.');
        }

        return $tokens;
    }

    public function revokeAllSessions(User $user): void
    {
        RefreshToken::query()->where('user_id', $user->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
        $user->tokens()->delete();
    }

    public function revoke(User $user, string $plainTextToken): void
    {
        DB::transaction(function () use ($user, $plainTextToken) {
            $record = RefreshToken::query()
                ->where('user_id', $user->id)
                ->where('token_hash', hash('sha256', $plainTextToken))
                ->lockForUpdate()
                ->first();

            if ($record && ! $record->revoked_at) {
                $record->revoked_at = now();
                $record->save();
            }

            $currentAccessToken = $user->currentAccessToken();

            if ($currentAccessToken instanceof PersonalAccessToken) {
                $currentAccessToken->delete();
            }
        });
    }
}
