<?php

namespace App\Modules\admin\Services;

use App\Models\RefreshToken;
use App\Models\User;
use App\Modules\auth\State\UserStateMachine;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;

final class AdminUserService
{
    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly UserStateMachine $users,
        private readonly AuditLogger $audit,
    ) {}

    /** POST /admin/users/{id}/suspend — ACTIVE -> SUSPENDED, semua token dicabut. */
    public function suspend(User $user, User $admin, string $reason, ?string $ip = null): User
    {
        if ($user->role === 'ADMIN') {
            throw new BusinessRuleViolation('Admin accounts cannot be suspended through the API.');
        }

        return $this->transactions->run(function () use ($user, $admin, $reason, $ip) {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            $before = ['status' => $user->status];

            $this->users->transition($user, 'SUSPENDED');
            $user->save();

            $user->tokens()->delete();
            RefreshToken::query()->where('user_id', $user->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);

            $this->audit->log($admin, 'USER_SUSPENDED', $user, $before, ['status' => $user->status, 'reason' => $reason], $ip);

            return $user;
        });
    }
}
