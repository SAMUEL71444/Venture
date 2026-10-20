<?php

use App\Models\User;
use App\Modules\auth\State\UserStateMachine;
use App\Modules\auth\State\VerificationStateMachine;
use App\Shared\Exceptions\InvalidStateTransition;
use Illuminate\Database\Eloquent\Model;

it('transitions a user from pending verification to active', function () {
    $user = new User;
    $user->status = 'PENDING_VERIFICATION';

    app(UserStateMachine::class)->transition($user, 'ACTIVE');

    expect($user->status)->toBe('ACTIVE');
});

it('rejects invalid user status transitions', function () {
    $user = new User;
    $user->status = 'PENDING_VERIFICATION';

    app(UserStateMachine::class)->transition($user, 'SUSPENDED');
})->throws(InvalidStateTransition::class);

it('transitions profile verification from pending to verified or rejected', function (string $target) {
    $profile = new class extends Model
    {
        protected $guarded = [];
    };
    $profile->verification_status = 'PENDING';

    app(VerificationStateMachine::class)->transition($profile, $target);

    expect($profile->verification_status)->toBe($target);
})->with(['VERIFIED', 'REJECTED']);

it('rejects invalid verification status transitions', function () {
    $profile = new class extends Model
    {
        protected $guarded = [];
    };
    $profile->verification_status = 'VERIFIED';

    app(VerificationStateMachine::class)->transition($profile, 'PENDING');
})->throws(InvalidStateTransition::class);
