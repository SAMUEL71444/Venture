<?php

use App\Models\User;

it('returns TOO_MANY_REQUESTS with a Retry-After header and retry_after detail', function () {
    User::factory()->create(['email' => 'user@example.test', 'password_hash' => 'correct horse battery', 'status' => 'ACTIVE']);

    foreach (range(1, 5) as $attempt) {
        $this->postJson('/api/v1/auth/login', ['identifier' => 'user@example.test', 'password' => 'wrong password'])
            ->assertUnauthorized();
    }

    $response = $this->postJson('/api/v1/auth/login', ['identifier' => 'user@example.test', 'password' => 'wrong password'])
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'TOO_MANY_REQUESTS')
        ->assertHeader('Retry-After');

    $retryAfter = (int) $response->headers->get('Retry-After');
    expect($retryAfter)->toBeGreaterThan(0)
        ->and($response->json('error.details.retry_after'))->toBe($retryAfter);
});

it('exposes the Retry-After header to the browser through CORS', function () {
    expect(config('cors.exposed_headers'))->toContain('Retry-After')
        ->and(config('cors.supports_credentials'))->toBeFalse();

    config(['cors.allowed_origins' => ['http://localhost:3000']]);

    $this->withHeaders(['Origin' => 'http://localhost:3000'])
        ->getJson('/api/v1/health')
        ->assertOk()
        ->assertHeader('Access-Control-Expose-Headers', 'Retry-After');
});
