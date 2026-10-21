<?php

namespace App\Modules\admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AdminAlert;
use App\Models\Escrow;
use App\Modules\admin\Http\Resources\AdminEscrowResource;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Daftar dana escrow per kontrak untuk Verify & Trust (read-only). */
final class AdminEscrowController extends Controller
{
    /** Filter status yang dipakai halaman: ditahan / dicairkan / dikembalikan / diselesaikan / belum didanai. */
    private const STATUS_GROUPS = [
        'held' => ['HELD', 'PARTIALLY_RELEASED'],
        'released' => ['RELEASED'],
        'refunded' => ['REFUNDED'],
        'settled' => ['SETTLED'],
        'pending' => ['PENDING_FUNDING'],
    ];

    /** GET /admin/escrows?status=&page=&per_page= — terbaru diperbarui dulu. */
    public function index(Request $request)
    {
        $input = $request->validate([
            'status' => ['nullable', Rule::in(array_keys(self::STATUS_GROUPS))],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        $query = Escrow::query()->with([
            'contract:id,contract_no,status,project_id,umkm_id,student_id,funded_at',
            'contract.project:id,title',
            'contract.umkm:id,name',
            'contract.student:id,name',
            'contract.milestones:id,contract_id,sequence,title,amount,status',
        ]);
        if (! empty($input['status'])) {
            $query->whereIn('status', self::STATUS_GROUPS[$input['status']]);
        }

        $page = $query->orderByDesc('updated_at')->orderByDesc('id')->paginate($input['per_page'] ?? 20);

        // Force approve ditolak backend selama alert UMKM_UNRESPONSIVE masih berjalan.
        $milestoneIds = $page->getCollection()->flatMap(fn (Escrow $escrow) => $escrow->contract->milestones->pluck('id'));
        $blocked = AdminAlert::query()->where('type', 'UMKM_UNRESPONSIVE')->where('reference_type', 'MILESTONE')
            ->whereIn('reference_id', $milestoneIds)->whereIn('status', ['OPEN', 'FOLLOWED_UP'])->pluck('reference_id')->all();

        return ApiResponse::success(
            $page->getCollection()->map(fn (Escrow $escrow) => (new AdminEscrowResource($escrow))->additional(['unresponsive_milestones' => $blocked])->resolve())->all(),
            [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        );
    }
}
