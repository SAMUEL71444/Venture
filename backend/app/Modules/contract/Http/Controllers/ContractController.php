<?php

namespace App\Modules\contract\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\MentorAssignment;
use App\Models\Milestone;
use App\Models\User;
use App\Modules\contract\State\ContractStateMachine;
use App\Modules\notification\Services\NotificationService;
use App\Modules\review\Services\MilestoneReviewService;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Http\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

final class ContractController extends Controller
{
    /**
     * Mahasiswa klik Mulai Kerja: kontrak FUNDED -> IN_PROGRESS, milestone pertama
     * LOCKED -> IN_PROGRESS, lalu mentor ditugaskan (05-sequence-diagram.md bagian 3).
     */
    public function start(
        Request $request,
        Contract $contract,
        TransactionRunner $transactions,
        ContractStateMachine $stateMachine,
        MilestoneReviewService $reviews,
        AuditLogger $audit,
        NotificationService $notifications,
    ) {
        if ($request->user()->id !== $contract->student_id) {
            throw new AuthorizationException('Only the contracted student can start this contract.');
        }

        $contract = $transactions->run(function () use ($request, $contract, $stateMachine, $reviews, $audit, $notifications) {
            $contract = Contract::query()->lockForUpdate()->findOrFail($contract->id);
            $before = ['status' => $contract->status];

            $stateMachine->transition($contract, 'IN_PROGRESS');

            $first = Milestone::query()
                ->where('contract_id', $contract->id)
                ->orderBy('sequence')
                ->lockForUpdate()
                ->first();

            if (! $first) {
                throw new BusinessRuleViolation('Contract has no milestones to start.');
            }

            $contract->started_at = now();
            $contract->save();

            $reviews->openMilestone($first);
            $notifications->notify(User::query()->find($contract->umkm_id), 'WORK_STARTED', 'Pengerjaan dimulai',
                "Mahasiswa sudah memulai pengerjaan kontrak {$contract->contract_no}.", ['contract_id' => $contract->id]);

            $audit->log($request->user(), 'CONTRACT_STARTED', $contract, $before, [
                'status' => $contract->status,
                'milestone_id' => $first->id,
                'mentor_id' => $first->mentor_id,
            ], $request->ip());

            return $contract;
        });

        return ApiResponse::success($contract->load('milestones'));
    }

    /** GET /contracts — UMKM/Mahasiswa: kontrak miliknya. Mentor: kontrak yang pernah ia review. Admin: semua. */
    public function index(Request $request)
    {
        $input = $request->validate([
            'status' => ['nullable', 'in:AWAITING_PAYMENT,FUNDED,IN_PROGRESS,CANCELLATION_REQUESTED,COMPLETED,CANCELLED,TERMINATED'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $user = $request->user();
        $query = Contract::query()->with(['project:id,title,category_id', 'umkm:id,name', 'student:id,name'])->withCount('milestones');

        match ($user->role) {
            'UMKM' => $query->where('umkm_id', $user->id),
            'STUDENT' => $query->where('student_id', $user->id),
            'MENTOR' => $query->whereIn('id', $this->mentorContractIds($user->id)),
            'ADMIN' => null,
            default => throw new AuthorizationException,
        };

        if (! empty($input['status'])) {
            $query->where('status', $input['status']);
        }

        $page = $query->orderByDesc('created_at')->paginate($input['per_page'] ?? 20);

        return ApiResponse::success($page->items(), [
            'current_page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    /** GET /contracts/{id} — pihak kontrak, mentor milestone kontrak ini, atau admin. */
    public function show(Request $request, Contract $contract)
    {
        $user = $request->user();
        $allowed = match ($user->role) {
            'UMKM' => $contract->umkm_id === $user->id,
            'STUDENT' => $contract->student_id === $user->id,
            'MENTOR' => $this->mentorContractIds($user->id)->contains($contract->id),
            'ADMIN' => true,
            default => false,
        };

        if (! $allowed) {
            throw new AuthorizationException('You are not allowed to view this contract.');
        }

        return ApiResponse::success($contract->load([
            'project:id,title,category_id,city,deadline',
            'umkm:id,name',
            'student:id,name',
            'milestones',
            'escrow:id,contract_id,status,funded_amount,released_amount,refunded_amount,held_amount',
        ]));
    }

    private function mentorContractIds(string $mentorUserId): Collection
    {
        return MentorAssignment::query()
            ->join('milestones', 'milestones.id', '=', 'mentor_assignments.milestone_id')
            ->where('mentor_assignments.mentor_id', $mentorUserId)
            ->distinct()
            ->pluck('milestones.contract_id');
    }
}
