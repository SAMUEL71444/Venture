<?php

use App\Models\RefreshToken;
use App\Models\User;
use App\Modules\auth\Services\RefreshTokenService;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RefreshTokenServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_refresh_token_rotates_and_the_previous_token_cannot_be_reused(): void
    {
        $user = User::query()->create([
            'name' => 'Test Student',
            'email' => 'student@example.test',
            'password_hash' => 'password-secret',
            'role' => 'STUDENT',
            'status' => 'ACTIVE',
        ]);
        $service = app(RefreshTokenService::class);
        $first = $service->issue($user);

        $second = $service->rotate($first['refresh_token']);

        expect($second['token_type'])->toBe('Bearer')
            ->and($second['access_token'])->not->toBe($first['access_token'])
            ->and($second['refresh_token'])->not->toBe($first['refresh_token'])
            ->and(RefreshToken::query()->whereNotNull('replaced_by_id')->count())->toBe(1);

        expect(fn () => $service->rotate($first['refresh_token']))
            ->toThrow(AuthenticationException::class);
    }

    public function test_expired_refresh_tokens_are_rejected(): void
    {
        $user = User::query()->create([
            'name' => 'Test Student',
            'email' => 'student@example.test',
            'password_hash' => 'password-secret',
            'role' => 'STUDENT',
            'status' => 'ACTIVE',
        ]);
        $service = app(RefreshTokenService::class);
        $tokens = $service->issue($user);
        RefreshToken::query()->first()->update(['expires_at' => now()->subSecond()]);

        expect(fn () => $service->rotate($tokens['refresh_token']))
            ->toThrow(AuthenticationException::class);
    }

    public function test_suspended_users_cannot_refresh_tokens(): void
    {
        $user = User::query()->create([
            'name' => 'Test Student',
            'email' => 'student@example.test',
            'password_hash' => 'password-secret',
            'role' => 'STUDENT',
            'status' => 'ACTIVE',
        ]);
        $service = app(RefreshTokenService::class);
        $tokens = $service->issue($user);
        $user->update(['status' => 'SUSPENDED']);

        expect(fn () => $service->rotate($tokens['refresh_token']))
            ->toThrow(AuthenticationException::class);
    }
}
