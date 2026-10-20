<?php

namespace App\Http\Middleware;

use App\Shared\Http\ApiResponse;
use Closure;
use Illuminate\Http\Request;

final class EnsureUserAccountCanAccessApi
{
    private const PENDING_ALLOWED_PATHS = [
        'api/v1/auth/logout',
        'api/v1/me/profile',
        'api/v1/students/me/verification',
        'api/v1/students/me/campus-email/verification',
    ];

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($request->path() === 'api/v1/auth/logout') {
            return $next($request);
        }

        if ($user->status === 'SUSPENDED') {
            return ApiResponse::error('ACCOUNT_SUSPENDED', 'This account is suspended.', null, 403);
        }

        if ($user->status === 'PENDING_VERIFICATION'
            && ! in_array($request->path(), self::PENDING_ALLOWED_PATHS, true)) {
            return ApiResponse::error('ACCOUNT_PENDING_VERIFICATION', 'Complete account verification to access this resource.', null, 403);
        }

        if (! in_array($user->status, ['PENDING_VERIFICATION', 'ACTIVE'], true)) {
            return ApiResponse::error('ACCOUNT_UNAVAILABLE', 'This account cannot access the API.', null, 403);
        }

        return $next($request);
    }
}
