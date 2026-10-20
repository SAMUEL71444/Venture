<?php

namespace App\Modules\admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AdminAlert;
use App\Models\CancellationRequest;
use App\Models\Contract;
use App\Models\Milestone;
use App\Modules\admin\Services\AlertFollowUpService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class AdminAlertController extends Controller
{
    public const TYPES = ['UMKM_UNRESPONSIVE', 'MENTOR_OVERDUE', 'STUDENT_OVERDUE', 'STUDENT_NOT_STARTED', 'CANCELLATION_REQUEST', 'REVISION_LIMIT_DISPUTE', 'MENTOR_RETURN_LIMIT'];

    /** GET /admin/alerts — antrean eskalasi. Default: belum RESOLVED, severity HIGH dulu. */
    public function index(Request $request)
    {
        $input = $request->validate([
            'type' => ['nullable', Rule::in(self::TYPES)],
            'status' => ['nullable', Rule::in(['OPEN', 'FOLLOWED_UP', 'AWAITING_DECISION', 'RESOLVED'])],
            'severity' => ['nullable', Rule::in(['LOW', 'MEDIUM', 'HIGH'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $page = AdminAlert::query()
            ->when($input['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
            ->when($input['status'] ?? null, fn ($q, $status) => $q->where('status', $status), fn ($q) => $q->where('status', '!=', 'RESOLVED'))
            ->when($input['severity'] ?? null, fn ($q, $severity) => $q->where('severity', $severity))
            ->orderByRaw("CASE severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END")
            ->orderBy('created_at')
            ->paginate($input['per_page'] ?? 20);

        return ApiResponse::success($page->items(), [
            'current_page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    /** GET /admin/alerts/{id} — detail + riwayat follow up + konteks (submission, review mentor, kontrak). */
    public function show(AdminAlert $alert)
    {
        $alert->load('followUps');

        $reference = match ($alert->reference_type) {
            'MILESTONE' => Milestone::query()->with([
                'contract:id,contract_no,status,umkm_id,student_id,project_id,total_amount',
                'submissions' => fn ($q) => $q->orderByDesc('version_no')->with(['files', 'reviews']),
                'mentorAssignments',
            ])->find($alert->reference_id),
            'CONTRACT' => Contract::query()->with('milestones')->find($alert->reference_id),
            'CANCELLATION' => CancellationRequest::query()->with('contract.milestones')->find($alert->reference_id),
            default => null,
        };

        return ApiResponse::success(['alert' => $alert, 'reference' => $reference]);
    }

    /** POST /admin/alerts/{id}/follow-ups — Admin. Mencatat follow up & memulai batas 7 hari. */
    public function followUp(Request $request, AdminAlert $alert, AlertFollowUpService $followUps)
    {
        $input = $request->validate([
            'channel' => ['required', Rule::in(AlertFollowUpService::CHANNELS)],
            'outcome' => ['required', Rule::in(AlertFollowUpService::OUTCOMES)],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $alert = $followUps->record($alert, $request->user(), $input['channel'], $input['outcome'], $input['notes'] ?? null, $request->ip());

        return ApiResponse::success($alert, [], 201);
    }
}
