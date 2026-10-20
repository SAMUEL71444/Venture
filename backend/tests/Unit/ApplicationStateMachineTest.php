<?php

use App\Models\Application;
use App\Models\Invitation;
use App\Models\Project;
use App\Modules\application\State\ApplicationStateMachine;
use App\Modules\application\State\InvitationStateMachine;
use App\Modules\project\State\ProjectStateMachine;
use App\Shared\Exceptions\InvalidStateTransition;

it('allows valid application transitions', function (string $from, string $to) {
    $application = new Application;
    $application->status = $from;

    (new ApplicationStateMachine)->transition($application, $to);

    expect($application->status)->toBe($to);
})->with([
    ['PENDING', 'SHORTLISTED'],
    ['PENDING', 'ACCEPTED'],
    ['PENDING', 'REJECTED'],
    ['PENDING', 'WITHDRAWN'],
    ['SHORTLISTED', 'ACCEPTED'],
    ['SHORTLISTED', 'WITHDRAWN'],
]);

it('rejects invalid application transitions', function (string $from, string $to) {
    $application = new Application;
    $application->status = $from;

    (new ApplicationStateMachine)->transition($application, $to);
})->throws(InvalidStateTransition::class)->with([
    ['ACCEPTED', 'WITHDRAWN'],
    ['REJECTED', 'ACCEPTED'],
    ['WITHDRAWN', 'PENDING'],
    ['ACCEPTED', 'REJECTED'],
]);

it('handles invitation transitions', function () {
    $machine = new InvitationStateMachine;
    $invitation = new Invitation;
    $invitation->status = 'PENDING';

    $machine->transition($invitation, 'ACCEPTED');

    expect($invitation->status)->toBe('ACCEPTED')
        ->and(fn () => $machine->transition($invitation, 'DECLINED'))->toThrow(InvalidStateTransition::class);
});

it('follows the project state diagram', function (string $from, string $to, bool $valid) {
    $project = new Project;
    $project->status = $from;
    $attempt = fn () => (new ProjectStateMachine)->transition($project, $to);

    $valid ? $attempt() : expect($attempt)->toThrow(InvalidStateTransition::class);

    expect($project->status)->toBe($valid ? $to : $from);
})->with([
    ['DRAFT', 'OPEN', true],
    ['DRAFT', 'CANCELLED', true],
    ['OPEN', 'ASSIGNED', true],
    ['ASSIGNED', 'COMPLETED', true],
    ['DRAFT', 'ASSIGNED', false],
    ['ASSIGNED', 'DRAFT', false],
    ['COMPLETED', 'OPEN', false],
    ['CANCELLED', 'OPEN', false],
]);
