<?php

use App\Http\Middleware\EnsureUserAccountCanAccessApi;
use App\Http\Middleware\EnsureUserHasRole;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use App\Shared\Exceptions\InvalidWebhookSignature;
use App\Shared\Http\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // Otorisasi channel WebSocket chat: POST /api/broadcasting/auth dengan bearer token Sanctum.
    ->withBroadcasting(__DIR__.'/../routes/channels.php', ['prefix' => 'api', 'middleware' => ['auth:sanctum']])
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
            'account.access' => EnsureUserAccountCanAccessApi::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($exception instanceof InvalidStateTransition) {
                return ApiResponse::error('INVALID_STATE_TRANSITION', $exception->getMessage(), $exception->details, 409);
            }

            if ($exception instanceof InvalidWebhookSignature) {
                return ApiResponse::error('INVALID_SIGNATURE', $exception->getMessage(), null, 401);
            }

            if ($exception instanceof BusinessRuleViolation) {
                return ApiResponse::error($exception->errorCode, $exception->getMessage(), $exception->details, 422);
            }

            if ($exception instanceof ValidationException) {
                return ApiResponse::error('VALIDATION_FAILED', $exception->getMessage(), $exception->errors(), 422);
            }

            if ($exception instanceof AuthenticationException) {
                return ApiResponse::error('UNAUTHENTICATED', 'Authentication is required.', null, 401);
            }

            if ($exception instanceof AuthorizationException) {
                return ApiResponse::error('FORBIDDEN', 'You are not allowed to perform this action.', null, 403);
            }

            if ($exception instanceof ModelNotFoundException) {
                return ApiResponse::error('NOT_FOUND', 'The requested resource was not found.', null, 404);
            }

            if ($exception instanceof HttpExceptionInterface && $exception->getStatusCode() === 429) {
                $headers = $exception->getHeaders();
                $retryAfter = isset($headers['Retry-After']) ? (int) $headers['Retry-After'] : null;

                // Header Retry-After & X-RateLimit-* diteruskan agar klien bisa menampilkan hitung mundur.
                return ApiResponse::error('TOO_MANY_REQUESTS', 'Too many requests. Please try again later.', [
                    'retry_after' => $retryAfter,
                ], 429)->withHeaders($headers);
            }

            if ($exception instanceof HttpExceptionInterface) {
                $status = $exception->getStatusCode();
                $code = match ($status) {
                    404 => 'NOT_FOUND',
                    405 => 'METHOD_NOT_ALLOWED',
                    503 => 'SERVICE_UNAVAILABLE',
                    default => 'HTTP_ERROR',
                };

                return ApiResponse::error($code, $exception->getMessage() ?: 'The request could not be completed.', null, $status);
            }

            return ApiResponse::error('INTERNAL_SERVER_ERROR', 'An unexpected error occurred.', null, 500);
        });
    })->create();
