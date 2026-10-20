<?php

namespace App\Modules\review\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\MentorAssignment;
use App\Models\Milestone;
use App\Models\Submission;
use App\Models\SubmissionFile;
use App\Modules\review\Services\MilestoneReviewService;
use App\Shared\Http\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

final class MilestoneReviewController extends Controller
{
    /** Ekstensi hasil kerja digital yang diterima (desain, dokumen, arsip, video). */
    private const ALLOWED_MIMES = 'jpg,jpeg,png,webp,gif,svg,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,rar,7z,mp4,mov,psd,ai';

    private const MAX_FILES = 10;

    private const MAX_FILE_KB = 20480;

    public function __construct(private readonly MilestoneReviewService $reviews) {}

    /** POST /milestones/{id}/submissions — Mahasiswa. */
    public function submit(Request $request, Milestone $milestone)
    {
        $input = $request->validate([
            'notes' => ['nullable', 'string', 'max:4000'],
            'files' => ['required', 'array', 'min:1', 'max:'.self::MAX_FILES],
            'files.*' => ['required', 'file', 'max:'.self::MAX_FILE_KB, 'mimes:'.self::ALLOWED_MIMES],
        ]);

        $submission = $this->reviews->submit(
            $milestone,
            $request->user(),
            $input['notes'] ?? null,
            $request->file('files', []),
            $request->ip(),
        );

        return ApiResponse::success($submission, [], 201);
    }

    /** GET /mentor/review-queue — Mentor. Milestone MENTOR_REVIEW milik assignment ACTIVE mentor ini. */
    public function reviewQueue(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        $page = Milestone::query()
            ->select('milestones.*')
            ->join('mentor_assignments', function ($join) use ($request) {
                $join->on('mentor_assignments.milestone_id', '=', 'milestones.id')
                    ->where('mentor_assignments.status', 'ACTIVE')
                    ->where('mentor_assignments.mentor_id', $request->user()->id);
            })
            ->where('milestones.status', 'MENTOR_REVIEW')
            ->with([
                'contract:id,contract_no,project_id,status',
                'contract.project:id,title,category_id',
                'submissions' => fn ($query) => $query->where('status', 'PENDING_MENTOR')->with('files'),
            ])
            ->orderBy('milestones.updated_at')
            ->paginate($perPage);

        return ApiResponse::success($page->items(), [
            'current_page' => $page->currentPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'last_page' => $page->lastPage(),
        ]);
    }

    /** POST /submissions/{id}/mentor-review — Mentor yang ditugaskan. */
    public function mentorReview(Request $request, Submission $submission)
    {
        $input = $request->validate([
            'decision' => ['required', 'in:APPROVED,NEEDS_CHANGES'],
            'feedback' => ['required_if:decision,NEEDS_CHANGES', 'nullable', 'string', 'max:4000'],
        ]);

        $milestone = $this->reviews->mentorReview(
            $submission,
            $request->user(),
            $input['decision'],
            $input['feedback'] ?? null,
            $request->ip(),
        );

        return ApiResponse::success($milestone->fresh());
    }

    /** POST /submissions/{id}/client-review — UMKM pemilik project. */
    public function clientReview(Request $request, Submission $submission)
    {
        $input = $request->validate([
            'decision' => ['required', 'in:APPROVED,REVISION_REQUESTED'],
            'feedback' => ['required_if:decision,REVISION_REQUESTED', 'nullable', 'string', 'max:4000'],
        ]);

        $milestone = $this->reviews->clientReview(
            $submission,
            $request->user(),
            $input['decision'],
            $input['feedback'] ?? null,
            $request->ip(),
        );

        return ApiResponse::success($milestone->fresh());
    }

    /** POST /milestones/{id}/disputes — UMKM atau Mahasiswa pihak kontrak. */
    public function dispute(Request $request, Milestone $milestone)
    {
        $input = $request->validate([
            'reason' => ['required', 'string', 'max:4000'],
        ]);

        $milestone = $this->reviews->dispute($milestone, $request->user(), $input['reason'], $request->ip());

        return ApiResponse::success($milestone->fresh());
    }

    /**
     * GET /submissions/{id}/files/{file} — unduh hasil kerja dari private storage.
     * UMKM hanya bisa mengunduh submission yang sudah lolos mentor.
     */
    public function downloadFile(Request $request, Submission $submission, SubmissionFile $file)
    {
        if ($file->submission_id !== $submission->id) {
            abort(404);
        }

        $user = $request->user();
        $contract = $submission->milestone()->firstOrFail()->contract()->firstOrFail();

        $allowed = match ($user->role) {
            'ADMIN' => true,
            'STUDENT' => $contract->student_id === $user->id,
            'MENTOR' => MentorAssignment::query()
                ->where('milestone_id', $submission->milestone_id)
                ->where('mentor_id', $user->id)
                ->exists(),
            'UMKM' => $contract->umkm_id === $user->id
                && in_array($submission->status, ['PENDING_CLIENT', 'REVISION_REQUESTED', 'ACCEPTED'], true),
            default => false,
        };

        if (! $allowed) {
            throw new AuthorizationException('You are not allowed to download this file.');
        }

        if (! Storage::disk(MilestoneReviewService::FILE_DISK)->exists($file->file_url)) {
            abort(404);
        }

        return Storage::disk(MilestoneReviewService::FILE_DISK)->download($file->file_url, $file->file_name);
    }
}
