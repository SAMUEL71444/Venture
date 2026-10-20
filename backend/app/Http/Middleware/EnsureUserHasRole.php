<?php

namespace App\Http\Middleware;

use App\Shared\Http\ApiResponse;
use Closure;
use Illuminate\Http\Request;

final class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $user = $request->user();

        if (! $user) {
            return ApiResponse::error('UNAUTHENTICATED', 'Authentication is required.', null, 401);
        }

        if (! in_array($user->role, $roles, true)) {
            return ApiResponse::error('FORBIDDEN', 'You are not allowed to perform this action.', null, 403);
        }

        return $next($request);
    }
}
