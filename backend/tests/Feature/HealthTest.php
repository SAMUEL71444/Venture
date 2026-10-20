<?php

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_returns_the_versioned_api_health_response_in_the_standard_envelope(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('data.status', 'ok')
            ->assertJsonStructure(['data', 'meta']);
    }
}
