<?php

namespace App\Modules\cancellation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\CancellationRequest;
use App\Models\Contract;
use App\Modules\cancellation\Services\CancellationService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;

final class CancellationController extends Controller
{
    public function __construct(private readonly CancellationService $cancellations) {}

    /** POST /contracts/{id}/cancellations — UMKM, Mahasiswa pihak kontrak. DIRECT atau NEEDS_REVIEW otomatis. */
    public function store(Request $request, Contract $contract)
    {
        $input = $request->validate([
            'reason' => ['required', 'string', 'max:4000'],
            'evidence_urls' => ['nullable', 'array', 'max:10'],
            'evidence_urls.*' => ['url:https', 'max:2048'],
            // Hanya untuk UMKM yang membatalkan sebelum pengerjaan dimulai.
            'reopen_project' => ['nullable', 'boolean'],
        ]);

        $cancellation = $this->cancellations->request(
            $contract,
            $request->user(),
            $input['reason'],
            $input['evidence_urls'] ?? [],
            $request->boolean('reopen_project'),
            $request->ip(),
        );

        return ApiResponse::success($cancellation->load('contract:id,contract_no,status'), [], 201);
    }

    /** POST /cancellations/{id}/responses — pihak lain. */
    public function respond(Request $request, CancellationRequest $cancellation)
    {
        $input = $request->validate(['response' => ['required', 'string', 'max:4000']]);

        return ApiResponse::success($this->cancellations->respond($cancellation, $request->user(), $input['response']));
    }

    /** POST /cancellations/{id}/withdraw — pengaju. */
    public function withdraw(Request $request, CancellationRequest $cancellation)
    {
        return ApiResponse::success($this->cancellations->withdraw($cancellation, $request->user()));
    }
}
