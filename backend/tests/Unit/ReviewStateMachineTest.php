<?php

use App\Models\Contract;
use App\Models\Milestone;
use App\Models\Submission;
use App\Modules\contract\State\ContractStateMachine;
use App\Modules\project\State\MilestoneStateMachine;
use App\Modules\review\State\SubmissionStateMachine;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;

function milestoneWith(array $attributes): Milestone
{
    $milestone = new Milestone;
    foreach ($attributes as $key => $value) {
        $milestone->{$key} = $value;
    }

    return $milestone;
}

it('allows every milestone transition from the state diagram', function (string $from, string $to) {
    $milestone = milestoneWith(['status' => $from]);

    (new MilestoneStateMachine)->transition($milestone, $to);

    expect($milestone->status)->toBe($to);
})->with([
    ['LOCKED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'MENTOR_REVIEW'],
    ['MENTOR_REVIEW', 'IN_PROGRESS'],
    ['MENTOR_REVIEW', 'ESCALATED'],
    ['MENTOR_REVIEW', 'CLIENT_REVIEW'],
    ['CLIENT_REVIEW', 'APPROVED'],
    ['CLIENT_REVIEW', 'REVISION_REQUESTED'],
    ['CLIENT_REVIEW', 'ESCALATED'],
    ['REVISION_REQUESTED', 'IN_PROGRESS'],
    ['ESCALATED', 'APPROVED'],
    ['ESCALATED', 'IN_PROGRESS'],
    ['ESCALATED', 'CLIENT_REVIEW'],
    ['ESCALATED', 'CANCELLED'],
]);

it('rejects milestone transitions that are not in the state diagram', function (string $from, string $to) {
    (new MilestoneStateMachine)->transition(milestoneWith(['status' => $from]), $to);
})->throws(InvalidStateTransition::class)->with([
    ['LOCKED', 'MENTOR_REVIEW'],
    ['IN_PROGRESS', 'CLIENT_REVIEW'],
    ['IN_PROGRESS', 'APPROVED'],
    ['MENTOR_REVIEW', 'APPROVED'],
    ['CLIENT_REVIEW', 'IN_PROGRESS'],
    ['REVISION_REQUESTED', 'CLIENT_REVIEW'],
    ['APPROVED', 'IN_PROGRESS'],
    ['CANCELLED', 'IN_PROGRESS'],
]);

it('allows a revision while revision_count is below max_revisions', function () {
    $milestone = milestoneWith(['status' => 'CLIENT_REVIEW', 'revision_count' => 1, 'max_revisions' => 2]);

    (new MilestoneStateMachine)->assertRevisionAllowed($milestone);

    expect(true)->toBeTrue();
});

it('rejects a revision once revision_count reaches max_revisions', function () {
    $milestone = milestoneWith(['status' => 'CLIENT_REVIEW', 'revision_count' => 2, 'max_revisions' => 2]);

    (new MilestoneStateMachine)->assertRevisionAllowed($milestone);
})->throws(BusinessRuleViolation::class);

it('rejects a revision when the milestone is not in client review', function () {
    $milestone = milestoneWith(['status' => 'IN_PROGRESS', 'revision_count' => 0, 'max_revisions' => 2]);

    (new MilestoneStateMachine)->assertRevisionAllowed($milestone);
})->throws(InvalidStateTransition::class);

it('allows valid submission transitions', function (string $from, string $to) {
    $submission = new Submission;
    $submission->status = $from;

    (new SubmissionStateMachine)->transition($submission, $to);

    expect($submission->status)->toBe($to);
})->with([
    ['PENDING_MENTOR', 'RETURNED_BY_MENTOR'],
    ['PENDING_MENTOR', 'PENDING_CLIENT'],
    ['PENDING_CLIENT', 'REVISION_REQUESTED'],
    ['PENDING_CLIENT', 'ACCEPTED'],
]);

it('rejects invalid submission transitions', function (string $from, string $to) {
    $submission = new Submission;
    $submission->status = $from;

    (new SubmissionStateMachine)->transition($submission, $to);
})->throws(InvalidStateTransition::class)->with([
    ['PENDING_MENTOR', 'ACCEPTED'],
    ['RETURNED_BY_MENTOR', 'REVISION_REQUESTED'],
    ['ACCEPTED', 'REVISION_REQUESTED'],
]);

it('allows valid contract transitions and rejects invalid ones', function () {
    $contract = new Contract;
    $contract->status = 'FUNDED';
    $machine = new ContractStateMachine;

    $machine->transition($contract, 'IN_PROGRESS');
    $machine->transition($contract, 'COMPLETED');

    expect($contract->status)->toBe('COMPLETED');
    expect(fn () => $machine->transition($contract, 'IN_PROGRESS'))->toThrow(InvalidStateTransition::class);
});

it('freezes milestone work when the contract is not in progress', function (string $status) {
    $contract = new Contract;
    $contract->status = $status;

    (new ContractStateMachine)->assertWorkAllowed($contract);
})->throws(InvalidStateTransition::class)->with(['FUNDED', 'CANCELLATION_REQUESTED', 'COMPLETED', 'TERMINATED']);
