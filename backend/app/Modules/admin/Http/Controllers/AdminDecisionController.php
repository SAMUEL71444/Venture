<?php

namespace App\Modules\admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\CancellationRequest;
use App\Models\Contract;
use App\Models\Conversation;
use App\Models\Escrow;
use App\Models\Message;
use App\Models\Milestone;
use App\Models\MilestoneSettlement;
use App\Models\User;
use App\Modules\admin\Services\AdminMilestoneService;
use App\Modules\admin\Services\AdminUserService;
use App\Modules\cancellation\Services\CancellationService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;

/** Keputusan admin: pembatalan, terminasi, milestone yang ESCALATED, mentor, suspend akun. */
final class AdminDecisionController extends Controller
{
    public function __construct(
        private readonly CancellationService $cancellations,
        private readonly AdminMilestoneService $milestones,
    ) {}

    /** GET /admin/cancellations/{id} — detail + bukti + submission & riwayat review + saldo escrow. */
    public function showCancellation(CancellationRequest $cancellation)
    {
        $cancellation->load(['allocations', 'refunds']);
        $contract = Contract::query()->with([
            'project:id,title',
            'umkm:id,name',
            'student:id,name',
            'milestones.submissions' => fn ($q) => $q->orderByDesc('version_no')->with(['files', 'reviews']),
            'milestones.mentorAssignments',
        ])->findOrFail($cancellation->contract_id);

        $settled = MilestoneSettlement::query()->whereIn('milestone_id', $contract->milestones->pluck('id'))->pluck('milestone_id');

        return ApiResponse::success([
            'cancellation' => $cancellation,
            'contract' => $contract,
            'escrow' => Escrow::query()->where('contract_id', $contract->id)->first(['id', 'status', 'funded_amount', 'released_amount', 'refunded_amount', 'held_amount']),
            // Milestone yang wajib dialokasikan saat approve.
            'allocatable_milestones' => $contract->milestones
                ->filter(fn (Milestone $m) => ! in_array($m->status, ['APPROVED', 'CANCELLED'], true) && ! $settled->contains($m->id))
                ->map(fn (Milestone $m) => ['milestone_id' => $m->id, 'sequence' => $m->sequence, 'title' => $m->title, 'amount' => $m->amount, 'status' => $m->status])
                ->values(),
            // Riwayat chat UMKM-mahasiswa untuk bahan pertimbangan admin (pesan bertanda is_flagged disorot).
            'chat' => Message::query()
                ->whereIn('conversation_id', Conversation::query()->where('contract_id', $contract->id)
                    ->orWhere(fn ($q) => $q->where('project_id', $contract->project_id)->where('student_user_id', $contract->student_id))
                    ->pluck('id'))
                ->orderBy('created_at')->limit(500)->get(),
        ]);
    }

    /** POST /admin/cancellations/{id}/approve — isi alokasi dana per milestone. */
    public function approveCancellation(Request $request, CancellationRequest $cancellation)
    {
        $input = $this->validateAllocations($request);

        return ApiResponse::success($this->cancellations->approve($cancellation, $request->user(), $input['allocations'], $input['admin_notes'] ?? null, $request->ip()));
    }

    /** POST /admin/cancellations/{id}/reject. */
    public function rejectCancellation(Request $request, CancellationRequest $cancellation)
    {
        $input = $request->validate(['admin_notes' => ['required', 'string', 'max:4000']]);

        return ApiResponse::success($this->cancellations->reject($cancellation, $request->user(), $input['admin_notes'], $request->ip()));
    }

    /** POST /admin/contracts/{id}/terminate — hentikan kontrak dengan alokasi per milestone. */
    public function terminateContract(Request $request, Contract $contract)
    {
        $input = $this->validateAllocations($request, reasonRequired: true);

        return ApiResponse::success($this->cancellations->terminateByAdmin($contract, $request->user(), $input['allocations'], $input['admin_notes'], $request->ip()), [], 201);
    }

    public function forceApprove(Request $request, Milestone $milestone)
    {
        $notes = $request->validate(['notes' => ['nullable', 'string', 'max:4000']])['notes'] ?? null;

        return ApiResponse::success($this->milestones->forceApprove($milestone, $request->user(), $notes, $request->ip()));
    }

    public function returnToStudent(Request $request, Milestone $milestone)
    {
        $notes = $request->validate(['notes' => ['required', 'string', 'max:4000']])['notes'];

        return ApiResponse::success($this->milestones->returnToStudent($milestone, $request->user(), $notes, $request->ip()));
    }

    public function extraChance(Request $request, Milestone $milestone)
    {
        $notes = $request->validate(['notes' => ['nullable', 'string', 'max:4000']])['notes'] ?? null;

        return ApiResponse::success($this->milestones->extraChance($milestone, $request->user(), $notes, $request->ip()));
    }

    public function forwardToClient(Request $request, Milestone $milestone)
    {
        $notes = $request->validate(['notes' => ['nullable', 'string', 'max:4000']])['notes'] ?? null;

        return ApiResponse::success($this->milestones->forwardToClient($milestone, $request->user(), $notes, $request->ip()));
    }

    public function reassignMentor(Request $request, Milestone $milestone)
    {
        $mentorId = $request->validate(['mentor_id' => ['nullable', 'uuid']])['mentor_id'] ?? null;

        return ApiResponse::success($this->milestones->reassignMentor($milestone, $request->user(), $mentorId, $request->ip()));
    }

    /** POST /admin/users/{id}/suspend. */
    public function suspendUser(Request $request, User $user, AdminUserService $users)
    {
        $reason = $request->validate(['reason' => ['required', 'string', 'max:2000']])['reason'];

        return ApiResponse::success($users->suspend($user, $request->user(), $reason, $request->ip()));
    }

    private function validateAllocations(Request $request, bool $reasonRequired = false): array
    {
        return $request->validate([
            'allocations' => ['present', 'array'],
            'allocations.*.milestone_id' => ['required', 'uuid'],
            'allocations.*.amount_to_student' => ['required', 'integer', 'min:0'],
            'allocations.*.amount_to_umkm' => ['required', 'integer', 'min:0'],
            'admin_notes' => [$reasonRequired ? 'required' : 'nullable', 'string', 'max:4000'],
        ]);
    }
}
