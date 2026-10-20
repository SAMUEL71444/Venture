<?php

namespace App\Modules\certificate\Services;

use App\Models\Contract;
use App\Models\MentorAssignment;
use App\Models\MentorProfile;
use App\Models\Rating;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use App\Models\User;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * Rating setelah kontrak COMPLETED (README aturan 19): UMKM -> mahasiswa; mahasiswa -> UMKM dan mentor.
 * UMKM tidak menilai mentor. Satu rating per (kontrak, penilai, yang dinilai).
 */
final class RatingService
{
    public function __construct(private readonly TransactionRunner $transactions) {}

    public function rate(Contract $contract, User $rater, string $target, ?string $mentorId, int $score, ?string $comment): Rating
    {
        [$direction, $rateeId] = $this->resolveTarget($contract, $rater, $target, $mentorId);

        return $this->transactions->run(function () use ($contract, $rater, $direction, $rateeId, $score, $comment) {
            $contract = Contract::query()->lockForUpdate()->findOrFail($contract->id);
            if ($contract->status !== 'COMPLETED') {
                throw new InvalidStateTransition('Ratings are only allowed after the contract is COMPLETED.', ['status' => $contract->status]);
            }

            $exists = Rating::query()->where('contract_id', $contract->id)->where('rater_id', $rater->id)->where('ratee_id', $rateeId)->exists();
            if ($exists) {
                throw new BusinessRuleViolation('You have already rated this party for this contract.');
            }

            $rating = Rating::query()->create([
                'contract_id' => $contract->id,
                'rater_id' => $rater->id,
                'ratee_id' => $rateeId,
                'direction' => $direction,
                'score' => $score,
                'comment' => $comment,
            ]);

            $this->refreshAverage($rateeId, $direction);

            return $rating;
        });
    }

    /** @return array{0: string, 1: string} [direction, ratee user id] */
    private function resolveTarget(Contract $contract, User $rater, string $target, ?string $mentorId): array
    {
        if ($rater->id === $contract->umkm_id) {
            if ($target !== 'STUDENT') {
                throw new BusinessRuleViolation('UMKM can only rate the student.');
            }

            return ['UMKM_TO_STUDENT', $contract->student_id];
        }

        if ($rater->id !== $contract->student_id) {
            throw new AuthorizationException('Only contract parties can rate.');
        }

        return match ($target) {
            'UMKM' => ['STUDENT_TO_UMKM', $contract->umkm_id],
            'MENTOR' => ['STUDENT_TO_MENTOR', $this->reviewingMentor($contract, $mentorId)],
            default => throw new BusinessRuleViolation('Students can rate the UMKM or a mentor.'),
        };
    }

    /** Mentor harus pernah mereview milestone di kontrak ini. */
    private function reviewingMentor(Contract $contract, ?string $mentorId): string
    {
        $reviewed = MentorAssignment::query()
            ->join('milestones', 'milestones.id', '=', 'mentor_assignments.milestone_id')
            ->where('milestones.contract_id', $contract->id)
            ->where('mentor_assignments.review_count', '>', 0)
            ->distinct()
            ->pluck('mentor_assignments.mentor_id');

        if ($mentorId === null && $reviewed->count() === 1) {
            return $reviewed->first();
        }
        if ($mentorId === null || ! $reviewed->contains($mentorId)) {
            throw new BusinessRuleViolation('mentor_id must be a mentor who reviewed this contract.', ['mentor_ids' => $reviewed->values()->all()]);
        }

        return $mentorId;
    }

    private function refreshAverage(string $rateeId, string $direction): void
    {
        $average = round((float) Rating::query()->where('ratee_id', $rateeId)->where('direction', $direction)->avg('score'), 2);

        match ($direction) {
            'UMKM_TO_STUDENT' => StudentProfile::query()->where('user_id', $rateeId)->update(['rating_avg' => $average]),
            'STUDENT_TO_UMKM' => UmkmProfile::query()->where('user_id', $rateeId)->update(['rating_avg' => $average]),
            'STUDENT_TO_MENTOR' => MentorProfile::query()->where('user_id', $rateeId)->update(['rating_avg' => $average]),
        };
    }
}
