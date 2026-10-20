<?php

namespace App\Modules\project\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Invitation;
use App\Models\Project;
use App\Models\ProjectTemplate;
use App\Models\User;
use App\Modules\application\State\ApplicationStateMachine;
use App\Modules\application\State\InvitationStateMachine;
use App\Modules\matching\Services\MatchingService;
use App\Modules\payment\Services\PaymentService;
use App\Modules\project\Services\PremiumListingService;
use App\Modules\project\State\ProjectStateMachine;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use App\Shared\Http\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ProjectController extends Controller
{
    private const EDITABLE_STATUSES = ['DRAFT', 'OPEN'];

    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly ProjectStateMachine $stateMachine,
    ) {}

    /** GET /projects — Login. Selain admin/pemilik, hanya project OPEN yang tampil. */
    public function index(Request $request)
    {
        $input = $request->validate([
            'category_id' => ['nullable', 'uuid'],
            'city' => ['nullable', 'string', 'max:120'],
            'q' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', 'in:DRAFT,OPEN,ASSIGNED,COMPLETED,CANCELLED,CLOSED'],
            'mine' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $user = $request->user();
        $query = Project::query()->with(['category:id,name,slug', 'umkm:id,name']);

        if ($user->role === 'UMKM' && $request->boolean('mine')) {
            $query->where('umkm_id', $user->id);
            if (! empty($input['status'])) {
                $query->where('status', $input['status']);
            }
        } elseif ($user->role === 'ADMIN') {
            if (! empty($input['status'])) {
                $query->where('status', $input['status']);
            }
        } else {
            $query->where('status', 'OPEN');
        }

        if (! empty($input['category_id'])) {
            $query->where('category_id', $input['category_id']);
        }
        if (! empty($input['city'])) {
            $query->where('city', $input['city']);
        }
        if (! empty($input['q'])) {
            $query->whereRaw('LOWER(title) LIKE ?', ['%'.addcslashes(mb_strtolower($input['q']), '%_\\').'%']);
        }

        // Premium listing yang sedang aktif tampil lebih dulu.
        $page = $query->withPremiumFlag()->orderByDesc('is_premium')
            ->orderByDesc('published_at')->orderByDesc('created_at')->paginate($input['per_page'] ?? 20);

        return ApiResponse::success($page->items(), $this->paginationMeta($page));
    }

    /** GET /projects/{id} — Login. DRAFT hanya untuk pemilik/admin; daftar lamaran hanya untuk pemilik/admin. */
    public function show(Request $request, Project $project)
    {
        $user = $request->user();
        $isOwner = $this->isOwnerOrAdmin($user, $project);

        if (! $isOwner && $project->status === 'DRAFT') {
            abort(404);
        }

        $project->load(['category:id,name,slug', 'umkm:id,name', 'template']);
        $data = $project->toArray();
        $data['is_premium'] = Project::query()->whereKey($project->id)->withPremiumFlag()->value('is_premium') ? true : false;

        if ($isOwner) {
            $data['applications_count'] = $project->applications()->count();
        }
        if ($user->role === 'STUDENT') {
            $data['my_application'] = $project->applications()->where('student_id', $user->id)->latest()->first();
        }

        return ApiResponse::success($data);
    }

    /** POST /projects — UMKM. */
    public function store(Request $request)
    {
        $input = $request->validate($this->rules());
        $this->assertTemplateMatchesCategory($input['template_id'] ?? null, $input['category_id']);

        $project = Project::query()->create([
            ...$input,
            'umkm_id' => $request->user()->id,
            'status' => 'DRAFT',
        ]);

        return ApiResponse::success($project, [], 201);
    }

    /** PUT /projects/{id} — UMKM pemilik, hanya saat DRAFT/OPEN. */
    public function update(Request $request, Project $project)
    {
        $this->authorizeOwner($request->user(), $project);
        $input = $request->validate($this->rules(partial: true));

        $project = $this->transactions->run(function () use ($project, $input) {
            $project = Project::query()->lockForUpdate()->findOrFail($project->id);
            if (! in_array($project->status, self::EDITABLE_STATUSES, true)) {
                throw new InvalidStateTransition('Projects can only be edited while DRAFT or OPEN.', ['status' => $project->status]);
            }

            $project->fill($input);
            if ($project->budget_max < $project->budget_min) {
                throw new BusinessRuleViolation('budget_max must be greater than or equal to budget_min.');
            }
            $this->assertTemplateMatchesCategory($project->template_id, $project->category_id);
            $project->save();

            return $project;
        });

        return ApiResponse::success($project);
    }

    /** POST /projects/{id}/publish — UMKM. DRAFT -> OPEN, lalu kembalikan rekomendasi talent. */
    public function publish(Request $request, Project $project, MatchingService $matching, SchedulerPlanner $scheduler)
    {
        $this->authorizeOwner($request->user(), $project);

        $project = $this->transactions->run(function () use ($project, $scheduler) {
            $project = Project::query()->lockForUpdate()->findOrFail($project->id);
            $this->stateMachine->transition($project, 'OPEN');

            if ($project->deadline && $project->deadline->isPast()) {
                throw new BusinessRuleViolation('Project deadline must be in the future to publish.');
            }

            $project->published_at = now();
            $project->save();

            // OPEN -> CLOSED jika deadline lewat tanpa kontrak.
            $scheduler->projectPublished($project);

            return $project;
        });

        return ApiResponse::success($project, [
            'recommendations' => $matching->recommend($project->load('umkm.umkmProfile'), 10),
        ]);
    }

    /** POST /projects/{id}/cancel — UMKM, hanya DRAFT/OPEN. Lamaran & undangan terbuka ikut ditutup. */
    public function cancel(
        Request $request,
        Project $project,
        ApplicationStateMachine $applications,
        InvitationStateMachine $invitations,
    ) {
        $this->authorizeOwner($request->user(), $project);

        $project = $this->transactions->run(function () use ($project, $applications, $invitations) {
            $project = Project::query()->lockForUpdate()->findOrFail($project->id);
            if (! in_array($project->status, self::EDITABLE_STATUSES, true)) {
                throw new InvalidStateTransition('Projects can only be cancelled while DRAFT or OPEN.', ['status' => $project->status]);
            }
            $this->stateMachine->transition($project, 'CANCELLED');
            $project->save();

            Application::query()->where('project_id', $project->id)
                ->whereIn('status', ApplicationStateMachine::OPEN_STATUSES)
                ->lockForUpdate()->get()
                ->each(function (Application $application) use ($applications) {
                    $applications->transition($application, 'REJECTED');
                    $application->save();
                });

            Invitation::query()->where('project_id', $project->id)
                ->where('status', 'PENDING')
                ->lockForUpdate()->get()
                ->each(function (Invitation $invitation) use ($invitations) {
                    $invitations->transition($invitation, 'EXPIRED');
                    $invitation->save();
                });

            return $project;
        });

        return ApiResponse::success($project);
    }

    /** GET /projects/{id}/recommendations — UMKM pemilik. */
    public function recommendations(Request $request, Project $project, MatchingService $matching)
    {
        $this->authorizeOwner($request->user(), $project);

        if (! in_array($project->status, self::EDITABLE_STATUSES, true)) {
            throw new InvalidStateTransition('Recommendations are only available for DRAFT or OPEN projects.', ['status' => $project->status]);
        }

        return ApiResponse::success($matching->recommend($project->load('umkm.umkmProfile')));
    }

    /** POST /projects/{id}/premium — UMKM pemilik. Beli premium listing (harga & durasi dari setting). */
    public function premium(Request $request, Project $project, PremiumListingService $premium)
    {
        $input = $request->validate(['method' => ['required', Rule::in(PaymentService::METHODS)]]);
        $result = $premium->purchase($project, $request->user(), $input['method'], $request->ip());

        return ApiResponse::success(['premium_listing' => $result['listing'], 'payment' => $result['payment']], [], $result['created'] ? 201 : 200);
    }

    /** GET /templates — Publik. */
    public function templates(Request $request)
    {
        $input = $request->validate(['category_id' => ['nullable', 'uuid']]);

        $templates = ProjectTemplate::query()
            ->with('category:id,name,slug')
            ->when($input['category_id'] ?? null, fn ($query, $categoryId) => $query->where('category_id', $categoryId))
            ->orderBy('title')
            ->get();

        return ApiResponse::success($templates);
    }

    private function rules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'category_id' => [$required, 'uuid', 'exists:service_categories,id'],
            'template_id' => ['sometimes', 'nullable', 'uuid', 'exists:project_templates,id'],
            'title' => [$required, 'string', 'max:255'],
            'description' => [$required, 'string', 'max:4000'],
            'budget_min' => [$required, 'integer', 'min:1'],
            'budget_max' => [$required, 'integer', 'min:1', ...($partial ? [] : ['gte:budget_min'])],
            'deadline' => [$required, 'date', 'after:today'],
            'city' => ['sometimes', 'nullable', 'string', 'max:120'],
        ];
    }

    private function assertTemplateMatchesCategory(?string $templateId, string $categoryId): void
    {
        if ($templateId && ProjectTemplate::query()->whereKey($templateId)->value('category_id') !== $categoryId) {
            throw new BusinessRuleViolation('The template does not belong to the selected category.');
        }
    }

    private function authorizeOwner(User $user, Project $project): void
    {
        if ($user->id !== $project->umkm_id) {
            throw new AuthorizationException('Only the project owner can perform this action.');
        }
    }

    private function isOwnerOrAdmin(User $user, Project $project): bool
    {
        return $user->id === $project->umkm_id || $user->role === 'ADMIN';
    }

    private function paginationMeta($page): array
    {
        return [
            'current_page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ];
    }
}
