<?php

namespace App\Modules\application\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\Project;
use App\Modules\application\Services\ApplicationService;
use App\Shared\Http\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;

final class ApplicationController extends Controller
{
    public function __construct(private readonly ApplicationService $applications) {}

    /** POST /projects/{id}/applications — Mahasiswa. */
    public function store(Request $request, Project $project)
    {
        $input = $request->validate([
            'proposal' => ['required', 'string', 'max:4000'],
            'offered_price' => ['required', 'integer', 'min:1'],
            'estimated_days' => ['required', 'integer', 'min:1', 'max:365'],
            // Boleh kosong jika project memakai template: usulan default dari template.
            'proposed_milestones' => ['nullable', 'array', 'min:1', 'max:10'],
            'proposed_milestones.*.title' => ['required', 'string', 'max:255'],
            'proposed_milestones.*.description' => ['nullable', 'string', 'max:2000'],
            'proposed_milestones.*.amount' => ['required', 'integer', 'min:1'],
            'proposed_milestones.*.due_date' => ['required', 'date', 'after_or_equal:today'],
        ]);

        $application = $this->applications->apply($project, $request->user(), $input);

        return ApiResponse::success($application, [], 201);
    }

    /** GET /projects/{id}/applications — UMKM pemilik. Urut skor matching tertinggi. */
    public function index(Request $request, Project $project)
    {
        if ($project->umkm_id !== $request->user()->id) {
            throw new AuthorizationException('Only the project owner can view its applications.');
        }

        $applications = Application::query()
            ->where('project_id', $project->id)
            ->with([
                'student:id,name',
                'student.studentProfile:id,user_id,university_id,major,semester,rating_avg,completed_contracts_count',
                'student.studentProfile.university:id,name,city',
            ])
            ->orderByDesc('match_score')
            ->orderBy('created_at')
            ->get();

        return ApiResponse::success($applications);
    }

    /** POST /applications/{id}/accept — UMKM pemilik. Membuat kontrak. */
    public function accept(Request $request, Application $application)
    {
        $contract = $this->applications->accept($application, $request->user(), $request->ip());

        return ApiResponse::success(['contract' => $contract]);
    }

    /** POST /applications/{id}/reject — UMKM pemilik. */
    public function reject(Request $request, Application $application)
    {
        return ApiResponse::success($this->applications->reject($application, $request->user()));
    }

    /** POST /applications/{id}/withdraw — Mahasiswa pelamar. */
    public function withdraw(Request $request, Application $application)
    {
        return ApiResponse::success($this->applications->withdraw($application, $request->user()));
    }
}
