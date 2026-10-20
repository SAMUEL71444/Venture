<?php

namespace App\Modules\payment\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Modules\payment\Services\PaymentService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class PaymentController extends Controller
{
    /** POST /contracts/{id}/payments — UMKM pemilik. Buat tagihan escrow. */
    public function store(Request $request, Contract $contract, PaymentService $payments)
    {
        $input = $request->validate([
            'method' => ['required', Rule::in(PaymentService::METHODS)],
        ]);

        $result = $payments->createEscrowPayment($contract, $request->user(), $input['method'], $request->ip());

        return ApiResponse::success($result['payment'], [], $result['created'] ? 201 : 200);
    }
}
