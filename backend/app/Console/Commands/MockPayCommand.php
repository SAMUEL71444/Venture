<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Modules\payment\Gateway\MockPaymentGateway;
use App\Modules\payment\Gateway\PaymentGateway;
use App\Modules\payment\Services\PaymentService;
use Illuminate\Console\Command;

/** Simulasi webhook gateway mock untuk dev/frontend: php artisan payments:mock-pay {payment_id} */
final class MockPayCommand extends Command
{
    protected $signature = 'payments:mock-pay {payment : ID payment} {--status=PAID : PAID, FAILED, atau EXPIRED}';

    protected $description = 'Send a signed mock gateway webhook for a payment (non-production, mock driver only)';

    public function handle(PaymentGateway $gateway, PaymentService $payments): int
    {
        if (app()->isProduction() || ! $gateway instanceof MockPaymentGateway) {
            $this->error('Only available with the mock gateway outside production.');

            return self::FAILURE;
        }

        $payment = Payment::query()->find($this->argument('payment'));
        if (! $payment?->gateway_ref) {
            $this->error('Payment not found or has no gateway reference.');

            return self::FAILURE;
        }

        $raw = json_encode([
            'gateway_ref' => $payment->gateway_ref,
            'status' => strtoupper((string) $this->option('status')),
            'gross_amount' => $payment->total_charged,
        ], JSON_THROW_ON_ERROR);

        $result = $payments->handleWebhook($raw, [MockPaymentGateway::SIGNATURE_HEADER => $gateway->sign($raw)]);
        $this->info("Payment {$payment->id}: {$result['status']}");

        return self::SUCCESS;
    }
}
