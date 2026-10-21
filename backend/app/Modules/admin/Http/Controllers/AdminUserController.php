<?php

namespace App\Modules\admin\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\AdminAlert;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\Milestone;
use App\Models\Project;
use App\Models\User;
use App\Modules\admin\Http\Resources\AdminUserResource;
use App\Shared\Http\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Riwayat pengguna untuk Verify & Trust (read-only). */
final class AdminUserController extends Controller
{
    private const RELATIONS = ['umkmProfile:id,user_id,business_name', 'studentProfile:id,user_id,university_id,university_name_custom,verification_status', 'studentProfile.university:id,name', 'mentorProfile:id,user_id,verification_status'];

    /** GET /admin/users?q=&role=&status=&page=&per_page= — terbaru dulu. */
    public function index(Request $request)
    {
        $input = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(['UMKM', 'STUDENT', 'MENTOR', 'ADMIN'])],
            'status' => ['nullable', Rule::in(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:1,50'],
        ]);

        $query = User::query()->with(self::RELATIONS);

        if (! empty($input['q'])) {
            // LOWER(...) LIKE ... ESCAPE: pencarian tanpa beda huruf yang sama di SQLite & PostgreSQL.
            $term = '%'.addcslashes(mb_strtolower(trim($input['q'])), '%_\\').'%';
            $query->where(fn (Builder $q) => $q
                ->whereRaw("LOWER(name) LIKE ? ESCAPE '\\'", [$term])
                ->orWhereRaw("LOWER(email) LIKE ? ESCAPE '\\'", [$term])
                ->orWhereRaw("phone LIKE ? ESCAPE '\\'", [$term]));
        }
        foreach (['role', 'status'] as $filter) {
            if (! empty($input[$filter])) {
                $query->where($filter, $input[$filter]);
            }
        }

        $page = $query->orderByDesc('created_at')->orderByDesc('id')->paginate($input['per_page'] ?? 20);

        return ApiResponse::success(AdminUserResource::collection($page->getCollection())->resolve(), [
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ]);
    }

    /** GET /admin/users/{id} — profil + rekam jejak kontrak & sengketa. */
    public function show(User $user)
    {
        $user->load(self::RELATIONS);
        $contracts = Contract::query()->where('umkm_id', $user->id)->orWhere('student_id', $user->id)->get(['id', 'status']);
        $milestones = Milestone::query()->whereIn('contract_id', $contracts->pluck('id'))->pluck('id');
        $suspension = $user->status === 'SUSPENDED'
            ? AuditLog::query()->where('action', 'USER_SUSPENDED')->where('entity_id', $user->id)
                ->orderByDesc('created_at')->orderByDesc('id')->first(['after_data', 'created_at'])
            : null;

        return ApiResponse::success([
            ...(new AdminUserResource($user))->resolve(),
            'stats' => [
                'projects' => $user->role === 'UMKM' ? Project::query()->where('umkm_id', $user->id)->count() : null,
                'contracts_active' => $contracts->whereIn('status', ['AWAITING_PAYMENT', 'FUNDED', 'IN_PROGRESS', 'CANCELLATION_REQUESTED'])->count(),
                'contracts_completed' => $contracts->where('status', 'COMPLETED')->count(),
                'contracts_cancelled' => $contracts->whereIn('status', ['CANCELLED', 'TERMINATED'])->count(),
                'disputes' => AdminAlert::query()->where('type', 'REVISION_LIMIT_DISPUTE')->where('reference_type', 'MILESTONE')
                    ->whereIn('reference_id', $milestones)->count(),
            ],
            'suspension' => $suspension ? [
                'reason' => $suspension->after_data['reason'] ?? null,
                'suspended_at' => $suspension->created_at?->toIso8601String(),
            ] : null,
        ]);
    }
}
