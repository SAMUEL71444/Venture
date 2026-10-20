<?php

namespace App\Modules\cancellation\Services;

use App\Models\AdminAlert;
use App\Models\CancellationAllocation;
use App\Models\CancellationRequest;
use App\Models\Contract;
use App\Models\Escrow;
use App\Models\MentorAssignment;
use App\Models\Milestone;
use App\Models\MilestoneSettlement;
use App\Models\Payment;
use App\Models\Project;
use App\Models\User;
use App\Modules\admin\Services\AdminAlertService;
use App\Modules\cancellation\State\CancellationStateMachine;
use App\Modules\contract\State\ContractStateMachine;
use App\Modules\ledger\Services\LedgerService;
use App\Modules\notification\Services\NotificationService;
use App\Modules\payment\Services\RefundService;
use App\Modules\payment\State\PaymentStateMachine;
use App\Modules\project\State\MilestoneStateMachine;
use App\Modules\project\State\ProjectStateMachine;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use App\Shared\Settings\PlatformSettingsService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Carbon;

/**
 * Pembatalan kontrak (05-sequence-diagram.md bagian 4, 04-state-diagram.md bagian 2 & 5,
 * 06-alur-keuangan-escrow.md bagian 3c & 4). Urutan lock: contract -> cancellation -> milestone -> escrow -> wallet.
 */
final class CancellationService
{
    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly CancellationStateMachine $requests,
        private readonly ContractStateMachine $contracts,
        private readonly ProjectStateMachine $projects,
        private readonly MilestoneStateMachine $milestones,
        private readonly PaymentStateMachine $payments,
        private readonly LedgerService $ledger,
        private readonly RefundService $refunds,
        private readonly AdminAlertService $alerts,
        private readonly NotificationService $notifications,
        private readonly SchedulerPlanner $scheduler,
        private readonly PlatformSettingsService $settings,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * POST /contracts/{id}/cancellations. AWAITING_PAYMENT / FUNDED -> batal langsung (DIRECT);
     * IN_PROGRESS -> pengajuan ke admin (NEEDS_REVIEW).
     *
     * @param  list<string>  $evidenceUrls
     */
    public function request(Contract $contract, User $actor, string $reason, array $evidenceUrls, bool $reopenProject, ?string $ip = null): CancellationRequest
    {
        $role = $this->partyRole($contract, $actor);

        return $this->transactions->run(function () use ($contract, $actor, $role, $reason, $evidenceUrls, $reopenProject, $ip) {
            $contract = Contract::query()->lockForUpdate()->findOrFail($contract->id);

            return match ($contract->status) {
                'AWAITING_PAYMENT', 'FUNDED' => $this->cancelDirectly($contract, $actor, $role, $reason, $evidenceUrls, $reopenProject, $ip),
                'IN_PROGRESS' => $this->openReview($contract, $actor, $role, $reason, $evidenceUrls, $ip),
                default => throw new InvalidStateTransition('This contract can no longer be cancelled.', ['status' => $contract->status]),
            };
        });
    }

    /** POST /cancellations/{id}/responses — pihak lain, sekali selama PENDING. */
    public function respond(CancellationRequest $request, User $actor, string $response): CancellationRequest
    {
        $contract = $request->contract()->firstOrFail();
        if ($request->requester_role === 'ADMIN' || $actor->id === $request->requested_by
            || ! in_array($actor->id, [$contract->umkm_id, $contract->student_id], true)) {
            throw new AuthorizationException('Only the other contract party can respond.');
        }

        return $this->transactions->run(function () use ($request, $response) {
            Contract::query()->lockForUpdate()->findOrFail($request->contract_id);
            $request = CancellationRequest::query()->lockForUpdate()->findOrFail($request->id);

            if ($request->counterparty_response !== null) {
                throw new InvalidStateTransition('A response has already been submitted.');
            }
            $this->requests->transition($request, 'PENDING');
            $request->counterparty_response = $response;
            $request->save();

            $this->notifications->notifyAdmins('CANCELLATION_RESPONSE', 'Tanggapan pembatalan masuk',
                'Pihak lain sudah menanggapi pengajuan pembatalan.', ['cancellation_request_id' => $request->id], [NotificationService::IN_APP]);

            return $request;
        });
    }

    /** POST /cancellations/{id}/withdraw — pengaju. Kontrak kembali IN_PROGRESS, timer dilanjutkan. */
    public function withdraw(CancellationRequest $request, User $actor): CancellationRequest
    {
        if ($actor->id !== $request->requested_by) {
            throw new AuthorizationException('Only the requester can withdraw this cancellation.');
        }

        return $this->transactions->run(function () use ($request, $actor) {
            [$contract, $request] = $this->lockPending($request);
            $this->requests->transition($request, 'WITHDRAWN');
            $request->resolved_at = now();
            $request->save();

            $this->resumeContract($contract, $request);
            $this->alerts->resolveAllFor([], null, $request->id, 'Pengajuan pembatalan ditarik pengaju.');
            $this->notifyParties($contract, 'CANCELLATION_WITHDRAWN', 'Pengajuan pembatalan ditarik',
                "Pengajuan pembatalan kontrak {$contract->contract_no} ditarik. Pengerjaan dilanjutkan.", $request, except: $actor->id);
            $this->audit->log($actor, 'CANCELLATION_WITHDRAWN', $request, ['status' => 'PENDING'], ['status' => 'WITHDRAWN']);

            return $request;
        });
    }

    /** POST /admin/cancellations/{id}/reject. */
    public function reject(CancellationRequest $request, User $admin, string $notes, ?string $ip = null): CancellationRequest
    {
        return $this->transactions->run(function () use ($request, $admin, $notes, $ip) {
            [$contract, $request] = $this->lockPending($request);
            $this->assertReadyForDecision($request);

            $this->requests->transition($request, 'REJECTED');
            $request->resolved_by = $admin->id;
            $request->admin_notes = $notes;
            $request->resolved_at = now();
            $request->save();

            $this->resumeContract($contract, $request);
            $this->alerts->resolveAllFor([], null, $request->id, 'Pembatalan ditolak admin.');
            $this->notifyParties($contract, 'CANCELLATION_DECIDED', 'Pembatalan ditolak',
                "Admin menolak pengajuan pembatalan kontrak {$contract->contract_no}. Pengerjaan dilanjutkan.", $request);
            $this->audit->log($admin, 'CANCELLATION_REJECTED', $request, ['status' => 'PENDING'], ['status' => 'REJECTED', 'admin_notes' => $notes], $ip);

            return $request;
        });
    }

    /**
     * POST /admin/cancellations/{id}/approve — admin mengisi alokasi per milestone.
     *
     * @param  list<array{milestone_id: string, amount_to_student: int, amount_to_umkm: int}>  $allocations
     */
    public function approve(CancellationRequest $request, User $admin, array $allocations, ?string $notes, ?string $ip = null): CancellationRequest
    {
        return $this->transactions->run(function () use ($request, $admin, $allocations, $notes, $ip) {
            [$contract, $request] = $this->lockPending($request);
            $this->assertReadyForDecision($request);

            return $this->terminate($contract, $request, $admin, $allocations, $notes, $ip);
        });
    }

    /**
     * POST /admin/contracts/{id}/terminate — keputusan admin dari eskalasi (UMKM diam, batas mentor,
     * sengketa). Diproses seperti pembatalan yang disetujui admin (D6-9).
     *
     * @param  list<array{milestone_id: string, amount_to_student: int, amount_to_umkm: int}>  $allocations
     */
    public function terminateByAdmin(Contract $contract, User $admin, array $allocations, string $reason, ?string $ip = null): CancellationRequest
    {
        return $this->transactions->run(function () use ($contract, $admin, $allocations, $reason, $ip) {
            $contract = Contract::query()->lockForUpdate()->findOrFail($contract->id);
            if ($contract->status === 'CANCELLATION_REQUESTED') {
                throw new InvalidStateTransition('A cancellation request is pending; decide it via /admin/cancellations/{id}.');
            }
            $this->contracts->transition($contract, 'CANCELLATION_REQUESTED');

            $request = CancellationRequest::query()->create([
                'contract_id' => $contract->id,
                'requested_by' => $admin->id,
                'requester_role' => 'ADMIN',
                'type' => 'NEEDS_REVIEW',
                'reason' => $reason,
                'status' => 'PENDING',
            ]);

            return $this->terminate($contract, $request, $admin, $allocations, $reason, $ip);
        });
    }

    // ------------------------------------------------------------------ internal

    private function cancelDirectly(Contract $contract, User $actor, string $role, string $reason, array $evidenceUrls, bool $reopenProject, ?string $ip): CancellationRequest
    {
        $before = ['status' => $contract->status];
        $wasFunded = $contract->status === 'FUNDED';

        $request = CancellationRequest::query()->create([
            'contract_id' => $contract->id,
            'requested_by' => $actor->id,
            'requester_role' => $role,
            'type' => 'DIRECT',
            'reason' => $reason,
            'evidence_urls' => $evidenceUrls ?: null,
            'status' => 'APPROVED',
            'resolved_at' => now(),
        ]);

        if ($wasFunded) {
            // Nilai project dikembalikan penuh; biaya gateway tidak.
            $amount = $this->ledger->refundEscrowInFull($contract);
            $payment = Payment::query()->findOrFail(Escrow::query()->where('contract_id', $contract->id)->value('payment_id'));
            $this->refunds->request($payment, $amount, $request->id, fromPayable: true);
        } else {
            // Tagihan yang belum dibayar tidak berlaku lagi. Jika tetap dibayar, webhook me-refund otomatis.
            Payment::query()->where('reference_type', 'CONTRACT')->where('reference_id', $contract->id)
                ->where('status', 'PENDING')->lockForUpdate()->get()
                ->each(function (Payment $payment) {
                    $this->payments->transition($payment, 'EXPIRED');
                    $payment->save();
                });
        }

        $this->contracts->transition($contract, 'CANCELLED');
        $contract->cancelled_at = now();
        $contract->cancelled_by = $actor->id;
        $contract->save();

        // Mahasiswa batal -> project dibuka ulang agar UMKM bisa memilih mahasiswa lain (README 11).
        // UMKM batal -> buka ulang hanya jika diminta, selain itu project ikut CANCELLED.
        $project = Project::query()->lockForUpdate()->findOrFail($contract->project_id);
        if ($project->status === 'ASSIGNED') {
            $this->projects->transition($project, $role === 'STUDENT' || $reopenProject ? 'OPEN' : 'CANCELLED');
            $project->save();
        }

        $this->alerts->resolveAllFor([], $contract->id, null, 'Kontrak dibatalkan sebelum pengerjaan dimulai.');
        $this->notifyParties($contract, 'CONTRACT_CANCELLED', 'Kontrak dibatalkan',
            "Kontrak {$contract->contract_no} dibatalkan".($wasFunded ? '. Nilai project dikembalikan ke UMKM.' : '.'), $request, except: $actor->id);
        $this->audit->log($actor, 'CONTRACT_CANCELLED_DIRECT', $contract, $before, [
            'status' => $contract->status,
            'cancellation_request_id' => $request->id,
            'project_status' => $project->status,
        ], $ip);

        return $request;
    }

    private function openReview(Contract $contract, User $actor, string $role, string $reason, array $evidenceUrls, ?string $ip): CancellationRequest
    {
        $this->contracts->transition($contract, 'CANCELLATION_REQUESTED');
        $contract->save();

        $request = CancellationRequest::query()->create([
            'contract_id' => $contract->id,
            'requested_by' => $actor->id,
            'requester_role' => $role,
            'type' => 'NEEDS_REVIEW',
            'reason' => $reason,
            'evidence_urls' => $evidenceUrls ?: null,
            'status' => 'PENDING',
            'response_due_at' => now()->addDays($this->settings->int('cancellation_response_days')),
        ]);

        $alert = $this->alerts->open('CANCELLATION_REQUEST', 'MEDIUM', 'CANCELLATION', $request->id);
        $this->scheduler->cancellationRequested($request);

        $this->notifyParties($contract, 'CANCELLATION_REQUESTED', 'Pengajuan pembatalan',
            "Ada pengajuan pembatalan kontrak {$contract->contract_no}. Silakan beri tanggapan dalam {$this->settings->int('cancellation_response_days')} hari.",
            $request, except: $actor->id, channels: [NotificationService::WHATSAPP]);
        $this->notifications->notifyAdmins('ADMIN_ALERT', 'Pengajuan pembatalan baru', "Kontrak {$contract->contract_no} diajukan untuk dibatalkan.",
            ['cancellation_request_id' => $request->id, 'alert_id' => $alert->id], [NotificationService::IN_APP, NotificationService::WHATSAPP]);
        $this->audit->log($actor, 'CANCELLATION_REQUESTED', $request, null, ['contract_id' => $contract->id, 'reason' => $reason], $ip);

        return $request;
    }

    private function terminate(Contract $contract, CancellationRequest $request, User $admin, array $allocations, ?string $notes, ?string $ip): CancellationRequest
    {
        $openMilestones = Milestone::query()->where('contract_id', $contract->id)
            ->whereNotIn('status', ['APPROVED', 'CANCELLED'])
            ->whereNotIn('id', MilestoneSettlement::query()->select('milestone_id'))
            ->orderBy('sequence')->lockForUpdate()->get();

        $normalized = $this->validateAllocations($openMilestones, $allocations);
        $result = $this->ledger->settleTermination($contract, $normalized);

        foreach ($openMilestones as $milestone) {
            CancellationAllocation::query()->create([
                'cancellation_request_id' => $request->id,
                'milestone_id' => $milestone->id,
                'amount_to_student' => $normalized[$milestone->id]['amount_to_student'],
                'amount_to_umkm' => $normalized[$milestone->id]['amount_to_umkm'],
                'mentor_fee' => (int) MilestoneSettlement::query()->where('milestone_id', $milestone->id)->value('mentor_fee'),
            ]);

            $this->milestones->cancelForTermination($milestone);
            $milestone->save();
        }
        MentorAssignment::query()->whereIn('milestone_id', $openMilestones->pluck('id'))->where('status', 'ACTIVE')
            ->update(['status' => 'DONE', 'updated_at' => now()]);

        $this->requests->transition($request, 'APPROVED');
        $request->resolved_by = $admin->id;
        $request->admin_notes = $notes;
        $request->resolved_at = now();
        $request->save();

        $this->contracts->transition($contract, 'TERMINATED');
        $contract->cancelled_at = now();
        $contract->cancelled_by = $request->requested_by;
        $contract->save();

        $project = Project::query()->lockForUpdate()->findOrFail($contract->project_id);
        if ($project->status === 'ASSIGNED') {
            $this->projects->transition($project, 'CANCELLED');
            $project->save();
        }

        if ($result['to_umkm'] > 0) {
            $payment = Payment::query()->findOrFail(Escrow::query()->where('contract_id', $contract->id)->value('payment_id'));
            $this->refunds->request($payment, $result['to_umkm'], $request->id, fromPayable: true);
        }

        $milestoneIds = Milestone::query()->where('contract_id', $contract->id)->pluck('id')->all();
        $this->alerts->resolveAllFor($milestoneIds, $contract->id, $request->id, 'Kontrak dihentikan admin.');

        $this->notifyParties($contract, 'CANCELLATION_DECIDED', 'Kontrak dihentikan',
            "Admin menghentikan kontrak {$contract->contract_no}. Ke mahasiswa Rp ".number_format($result['to_student'], 0, ',', '.')
            .', dikembalikan ke UMKM Rp '.number_format($result['to_umkm'], 0, ',', '.').'.', $request, channels: [NotificationService::WHATSAPP]);
        $this->notifications->notify(User::query()->whereIn('id', array_keys($result['mentor_fees']))->get(), 'MENTOR_FEE_PAID',
            'Komisi review dibayarkan', "Kontrak {$contract->contract_no} dihentikan; komisi review Anda tetap dibayarkan.", ['contract_id' => $contract->id]);

        $this->audit->log($admin, 'CONTRACT_TERMINATED', $contract, ['status' => 'CANCELLATION_REQUESTED'], [
            'status' => 'TERMINATED',
            'cancellation_request_id' => $request->id,
            'allocations' => $normalized,
            'to_student' => $result['to_student'],
            'to_umkm' => $result['to_umkm'],
            'mentor_fees' => $result['mentor_fees'],
        ], $ip);

        return $request->load('allocations');
    }

    /**
     * Setiap milestone yang dananya masih ditahan wajib dialokasikan tepat sekali dan
     * amount_to_student + amount_to_umkm = nilai milestone.
     *
     * @return array<string, array{amount_to_student: int, amount_to_umkm: int}>
     */
    private function validateAllocations($openMilestones, array $allocations): array
    {
        $byId = [];
        foreach ($allocations as $allocation) {
            $id = (string) $allocation['milestone_id'];
            if (isset($byId[$id])) {
                throw new BusinessRuleViolation('Each milestone may only be allocated once.', ['milestone_id' => $id]);
            }
            $byId[$id] = ['amount_to_student' => (int) $allocation['amount_to_student'], 'amount_to_umkm' => (int) $allocation['amount_to_umkm']];
        }

        $expected = $openMilestones->pluck('id')->all();
        $unknown = array_diff(array_keys($byId), $expected);
        $missing = array_diff($expected, array_keys($byId));
        if ($unknown !== [] || $missing !== []) {
            throw new BusinessRuleViolation('Allocations must cover every unsettled milestone exactly once.', [
                'missing_milestone_ids' => array_values($missing),
                'unknown_milestone_ids' => array_values($unknown),
            ]);
        }

        foreach ($openMilestones as $milestone) {
            $allocation = $byId[$milestone->id];
            if ($allocation['amount_to_student'] < 0 || $allocation['amount_to_umkm'] < 0
                || (int) $milestone->amount !== $allocation['amount_to_student'] + $allocation['amount_to_umkm']) {
                throw new BusinessRuleViolation('Allocation must split the full milestone amount.', [
                    'milestone_id' => $milestone->id,
                    'milestone_amount' => $milestone->amount,
                ]);
            }
        }

        return $byId;
    }

    /** Kontrak kembali IN_PROGRESS; timer review UMKM digeser sebesar durasi jeda (07 bagian 2). */
    private function resumeContract(Contract $contract, CancellationRequest $request): void
    {
        $this->contracts->transition($contract, 'IN_PROGRESS');
        $contract->save();

        $pausedSeconds = (int) Carbon::parse($request->created_at)->diffInSeconds(now(), true);

        $reviewing = Milestone::query()->where('contract_id', $contract->id)->where('status', 'CLIENT_REVIEW')->lockForUpdate()->get();
        foreach ($reviewing as $milestone) {
            $milestone->client_review_paused_seconds += $pausedSeconds;
            $milestone->save();
            $this->scheduler->clientReviewStarted($milestone);

            AdminAlert::query()->where('type', 'UMKM_UNRESPONSIVE')->where('reference_type', 'MILESTONE')
                ->where('reference_id', $milestone->id)->where('status', 'FOLLOWED_UP')->lockForUpdate()->get()
                ->each(function (AdminAlert $alert) use ($pausedSeconds) {
                    $alert->follow_up_deadline = $alert->follow_up_deadline->addSeconds($pausedSeconds);
                    $alert->save();
                    $this->scheduler->followUpRecorded($alert);
                });
        }
    }

    /** @return array{0: Contract, 1: CancellationRequest} */
    private function lockPending(CancellationRequest $request): array
    {
        $contract = Contract::query()->lockForUpdate()->findOrFail($request->contract_id);
        $request = CancellationRequest::query()->lockForUpdate()->findOrFail($request->id);

        if ($request->status !== 'PENDING') {
            throw new InvalidStateTransition('This cancellation request is no longer pending.', ['status' => $request->status]);
        }

        return [$contract, $request];
    }

    /** Admin memutuskan setelah pihak lain menanggapi atau batas tanggapan lewat (D6-3). */
    private function assertReadyForDecision(CancellationRequest $request): void
    {
        if ($request->counterparty_response === null && $request->response_due_at && $request->response_due_at->isFuture()) {
            throw new BusinessRuleViolation('Waiting for the other party to respond.', ['response_due_at' => $request->response_due_at]);
        }
    }

    private function partyRole(Contract $contract, User $actor): string
    {
        return match ($actor->id) {
            $contract->umkm_id => 'UMKM',
            $contract->student_id => 'STUDENT',
            default => throw new AuthorizationException('Only contract parties can cancel this contract.'),
        };
    }

    private function notifyParties(Contract $contract, string $type, string $title, string $body, CancellationRequest $request, ?string $except = null, array $channels = []): void
    {
        $users = User::query()->whereIn('id', array_diff([$contract->umkm_id, $contract->student_id], [$except]))->get();

        $this->notifications->notify($users, $type, $title, $body, [
            'contract_id' => $contract->id,
            'cancellation_request_id' => $request->id,
        ], $channels);
    }
}
