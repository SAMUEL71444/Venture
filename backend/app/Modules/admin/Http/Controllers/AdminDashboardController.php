<?php

namespace App\Modules\admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AdminAlert;
use App\Models\AuditLog;
use App\Models\Escrow;
use App\Models\MentorProfile;
use App\Models\Milestone;
use App\Models\StudentProfile;
use App\Shared\Http\ApiResponse;

/** Ringkasan dashboard Verify & Trust (read-only). Angka & daftar pendek dengan field terbatas. */
final class AdminDashboardController extends Controller
{
    private const RECENT = 5;

    /** GET /admin/dashboard/summary */
    public function summary()
    {
        // Sama dengan antrean GET /admin/verifications.
        $pendingStudents = StudentProfile::query()->where('verification_status', 'PENDING')->whereNotNull('ktm_file_url');
        $pendingMentors = MentorProfile::query()->where('verification_status', 'PENDING');
        $heldEscrows = Escrow::query()->whereIn('status', ['HELD', 'PARTIALLY_RELEASED']);
        $openDisputes = AdminAlert::query()->where('type', 'REVISION_LIMIT_DISPUTE')->where('status', '!=', 'RESOLVED');

        $recentVerifications = (clone $pendingStudents)
            ->with(['user:id,name', 'university:id,name'])
            ->orderByDesc('ktm_submitted_at')->orderByDesc('id')->limit(self::RECENT)->get()
            ->map(fn (StudentProfile $profile) => [
                'id' => $profile->id,
                'type' => 'STUDENT_KTM',
                'name' => $profile->user?->name,
                'university' => $profile->university?->name ?? $profile->university_name_custom,
                'submitted_at' => ($profile->ktm_submitted_at ?? $profile->updated_at)?->toIso8601String(),
            ]);

        $disputes = AdminAlert::query()->where('type', 'REVISION_LIMIT_DISPUTE')
            ->orderByDesc('created_at')->orderByDesc('id')->limit(self::RECENT)->get();
        $milestones = Milestone::query()->with('contract:id,project_id', 'contract.project:id,title')
            ->whereIn('id', $disputes->pluck('reference_id'))->get(['id', 'contract_id', 'title'])->keyBy('id');
        $reasons = AuditLog::query()->where('action', 'MILESTONE_DISPUTED')->whereIn('entity_id', $disputes->pluck('reference_id'))
            ->orderBy('created_at')->orderBy('id')->get(['entity_id', 'after_data'])->keyBy('entity_id');

        return ApiResponse::success([
            'pending_verifications' => (clone $pendingStudents)->count() + $pendingMentors->count(),
            'held_funds' => [
                'amount' => (int) (clone $heldEscrows)->sum('held_amount'),
                'contracts' => (clone $heldEscrows)->count(),
            ],
            'active_disputes' => $openDisputes->count(),
            'recent_verifications' => $recentVerifications->values(),
            'recent_disputes' => $disputes->map(fn (AdminAlert $alert) => [
                'id' => $alert->id,
                'status' => $alert->status,
                'project' => $milestones->get($alert->reference_id)?->contract?->project?->title,
                'milestone' => $milestones->get($alert->reference_id)?->title,
                'reason' => $reasons->get($alert->reference_id)?->after_data['reason'] ?? null,
                'opened_at' => $alert->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }
}
