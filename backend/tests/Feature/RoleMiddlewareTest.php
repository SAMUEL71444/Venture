<?php

use App\Http\Middleware\EnsureUserHasRole;
use App\Models\User;
use Illuminate\Http\Request;

it('rejects a request without an authenticated user', function () {
    $request = Request::create('/api/v1/admin', 'GET');
    $response = app(EnsureUserHasRole::class)->handle($request, fn () => response('ok'), 'ADMIN');

    expect($response->getStatusCode())->toBe(401);
});

it('allows only users with an allowed role', function () {
    $user = new User;
    $user->setAttribute('role', 'ADMIN');
    $request = Request::create('/api/v1/admin', 'GET');
    $request->setUserResolver(fn () => $user);

    $response = app(EnsureUserHasRole::class)->handle($request, fn () => response('ok'), 'ADMIN');

    expect($response->getStatusCode())->toBe(200);
});
