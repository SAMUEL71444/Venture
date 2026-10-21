<?php

namespace App\Modules\admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AdminAlert;
use App\Models\AuditLog;
use App\Models\Milestone;
use App\Modules\admin\Http\Resources\AdminDisputeResource;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * Sengketa milestone (alert REVISION_LIMIT_DISPUTE) untuk Verify & Trust — read-only.
 * Keputusan memakai endpoint yang sudah ada: POST admin/milestones/{id}/force-approve
 * dan POST admin/milestones/{id}/return-to-student.
 */
final class AdminDisputeController extends Controller
{
    private const TYPE = 'REVISION_LIMIT_DISPUTE';

    private const MILESTONE_RELATIONS = ['contract:id,contract_no,status,project_id,umkm_id,student_id', 'contract.project:id,title', 'contract.umkm:id,name', 'contract.student:id,name'];

    /** GET /admin/disputes?status=open|resolved&page=&per_page= — terbaru dulu. */
    public function index(Request $request)
    {
        $input = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'resolved'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        $page = AdminAlert::query()->where('type', self::TYPE)
            ->when(($input['status'] ?? null) === 'open', fn ($q) => $q->where('status', '!=', 'RESOLVED'))
            ->when(($input['status'] ?? null) === 'resolved', fn ($q) => $q->where('status', 'RESOLVED'))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($input['per_page'] ?? 20);

        $alerts = $page->getCollection();
        $milestones = Milestone::query()->with(self::MILESTONE_RELATIONS)->whereIn('id', $alerts->pluck('reference_id'))->get()->keyBy('id');
        $disputes = $this->disputeLogs($alerts->pluck('reference_id'));

        return ApiResponse::success($alerts->map(fn (AdminAlert $alert) => (new AdminDisputeResource($alert))->additional([
            'milestone' => $milestones->get($alert->reference_id),
            'dispute' => $disputes->get($alert->reference_id),
        ])->resolve())->all(), [
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ]);
    }

    /** GET /admin/disputes/{alert} — detail + riwayat pengajuan & review milestone. */
    public function show(AdminAlert $alert)
    {
        abort_unless($alert->type === self::TYPE, 404);

        $milestone = Milestone::query()->with([
            ...self::MILESTONE_RELATIONS,
            'submissions' => fn ($q) => $q->orderBy('version_no')->with(['reviews' => fn ($r) => $r->orderBy('reviewed_at'), 'files:id,submission_id,file_name']),
        ])->find($alert->reference_id);

        return ApiResponse::success((new AdminDisputeResource($alert))->additional([
            'milestone' => $milestone,
            'dispute' => $this->disputeLogs(collect([$alert->reference_id]))->get($alert->reference_id),
            'with_history' => true,
        ])->resolve());
    }

    /** Alasan & pengaju sengketa terakhir per milestone, dari audit log MILESTONE_DISPUTED. */
    private function disputeLogs(Collection $milestoneIds): Collection
    {
        return AuditLog::query()->where('action', 'MILESTONE_DISPUTED')->whereIn('entity_id', $milestoneIds)
            ->orderBy('created_at')->orderBy('id')->get(['entity_id', 'after_data'])
            ->keyBy('entity_id');
    }
}
