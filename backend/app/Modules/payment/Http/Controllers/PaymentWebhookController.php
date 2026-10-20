<?php

namespace App\Modules\payment\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\payment\Services\PaymentService;
use App\Shared\Http\ApiResponse;
use Illuminate\Http\Request;

final class PaymentWebhookController extends Controller
{
    /** POST /webhooks/payment-gateway — dipanggil gateway, autentikasi lewat signature. */
    public function __invoke(Request $request, PaymentService $payments)
    {
        // Signature dihitung dari raw body persis seperti yang dikirim gateway.
        $result = $payments->handleWebhook($request->getContent(), $request->headers->all());

        return ApiResponse::success($result);
    }
}
