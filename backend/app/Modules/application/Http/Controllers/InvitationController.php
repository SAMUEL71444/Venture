<?php

namespace App\Modules\application\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Invitation;
use App\Models\Project;
use App\Modules\application\Services\InvitationService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;

final class InvitationController extends Controller
{
    public function __construct(private readonly InvitationService $invitations) {}

    /** POST /projects/{id}/invitations — UMKM pemilik. */
    public function invite(Request $request, Project $project)
    {
        $input = $request->validate([
            'student_id' => ['required', 'uuid'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        $invitation = $this->invitations->invite($project, $request->user(), $input['student_id'], $input['message'] ?? null);

        return ApiResponse::success($invitation, [], 201);
    }

    /** POST /invitations/{id}/accept — Mahasiswa yang diundang. */
    public function accept(Request $request, Invitation $invitation)
    {
        return ApiResponse::success($this->invitations->accept($invitation, $request->user()));
    }

    /** POST /invitations/{id}/decline — Mahasiswa yang diundang. */
    public function decline(Request $request, Invitation $invitation)
    {
        return ApiResponse::success($this->invitations->decline($invitation, $request->user()));
    }
}
