<?php

namespace App\Modules\certificate\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Contract;
use App\Modules\certificate\Services\CertificateService;
use App\Modules\certificate\Services\RatingService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class CertificateController extends Controller
{
    /** GET /certificates/{code}/verify — Publik (HRD). */
    public function verify(string $code, CertificateService $certificates)
    {
        $certificate = Certificate::query()->where('verification_code', $code)->first();
        if (! $certificate) {
            abort(404);
        }

        return ApiResponse::success($certificates->publicView($certificate));
    }

    /** GET /students/me/certificates — Mahasiswa. */
    public function mine(Request $request)
    {
        return ApiResponse::success(Certificate::query()
            ->where('student_id', $request->user()->id)
            ->with(['contract:id,contract_no,project_id,completed_at', 'contract.project:id,title'])
            ->orderByDesc('issued_at')
            ->get());
    }

    /**
     * POST /contracts/{id}/ratings — UMKM, Mahasiswa setelah COMPLETED.
     * UMKM: target STUDENT. Mahasiswa: target UMKM atau MENTOR (+ mentor_id jika lebih dari satu mentor).
     */
    public function rate(Request $request, Contract $contract, RatingService $ratings)
    {
        $input = $request->validate([
            'target' => ['required', Rule::in(['STUDENT', 'UMKM', 'MENTOR'])],
            'mentor_id' => ['nullable', 'uuid'],
            'score' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $rating = $ratings->rate($contract, $request->user(), $input['target'], $input['mentor_id'] ?? null, (int) $input['score'], $input['comment'] ?? null);

        return ApiResponse::success($rating, [], 201);
    }
}
