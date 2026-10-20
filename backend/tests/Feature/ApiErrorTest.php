<?php

use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiErrorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Route::get('/api/v1/_test/state-conflict', fn () => throw new InvalidStateTransition('Invalid transition.'));
        Route::get('/api/v1/_test/business-rule', fn () => throw new BusinessRuleViolation('Revision limit reached.'));
    }

    public function test_maps_invalid_state_transitions_to_a_standard_409_response(): void
    {
        $this->getJson('/api/v1/_test/state-conflict')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INVALID_STATE_TRANSITION');
    }

    public function test_maps_business_rule_violations_to_a_standard_422_response(): void
    {
        $this->getJson('/api/v1/_test/business-rule')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'BUSINESS_RULE_VIOLATION');
    }

    public function test_returns_standard_errors_for_unknown_api_routes(): void
    {
        $this->getJson('/api/v1/not-found')
            ->assertNotFound()
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }
}
