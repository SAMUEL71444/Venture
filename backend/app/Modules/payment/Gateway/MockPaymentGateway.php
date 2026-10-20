<?php

namespace App\Modules\payment\Gateway;

use App\Models\Payment;
use App\Modules\ledger\Services\FeeCalculator;
use App\Shared\Exceptions\BusinessRuleViolation;
use Illuminate\Support\Str;
use JsonException;
use RuntimeException;

/**
 * Gateway lokal untuk dev & test. Webhook ditandatangani HMAC-SHA256 atas raw body
 * dengan PAYMENT_WEBHOOK_SECRET, dikirim di header X-Signature.
 *
 * Payload: {"gateway_ref": "...", "status": "PAID|FAILED|EXPIRED", "gross_amount": 1004000}
 */
final class MockPaymentGateway implements PaymentGateway
{
    public const SIGNATURE_HEADER = 'x-signature';

    public function __construct(
        private readonly ?string $webhookSecret,
        private readonly array $fees,
    ) {}

    public function name(): string
    {
        return 'MOCK';
    }

    public function quoteFee(int $amount, string $method): int
    {
        $fee = $this->fees[$method] ?? null;
        if ($fee === null) {
            throw new BusinessRuleViolation("Payment method [{$method}] is not supported.");
        }

        return (int) $fee['flat'] + FeeCalculator::percentOf($amount, (int) $fee['bp']);
    }

    public function createCharge(Payment $payment): GatewayCharge
    {
        $ref = 'MOCK-'.Str::upper(Str::random(20));

        return new GatewayCharge($ref, 'mock://checkout/'.$ref);
    }

    /** Mock: refund langsung sukses. Driver asli biasanya PROCESSING lalu dikonfirmasi lewat webhook. */
    public function refund(Payment $payment, int $amount, string $reference): GatewayRefund
    {
        return new GatewayRefund('MOCK-RF-'.Str::upper(Str::random(16)), GatewayRefund::SUCCESS);
    }

    public function verifyWebhook(string $rawBody, array $headers): bool
    {
        $signature = $this->header($headers, self::SIGNATURE_HEADER);

        return $signature !== null && hash_equals($this->sign($rawBody), $signature);
    }

    public function parseWebhook(string $rawBody): GatewayEvent
    {
        try {
            $payload = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new BusinessRuleViolation('Webhook payload is not valid JSON.');
        }

        if (! is_array($payload) || ! is_string($payload['gateway_ref'] ?? null) || ! is_string($payload['status'] ?? null)) {
            throw new BusinessRuleViolation('Webhook payload must contain gateway_ref and status.');
        }

        $status = strtoupper($payload['status']);

        return new GatewayEvent(
            gatewayRef: $payload['gateway_ref'],
            status: $status,
            grossAmount: isset($payload['gross_amount']) && is_int($payload['gross_amount']) ? $payload['gross_amount'] : null,
            eventType: 'payment.'.strtolower($status),
            payload: $payload,
        );
    }

    /** Dipakai command payments:mock-pay dan test untuk mensimulasikan gateway. */
    public function sign(string $rawBody): string
    {
        if (blank($this->webhookSecret)) {
            throw new RuntimeException('PAYMENT_WEBHOOK_SECRET is not configured.');
        }

        return hash_hmac('sha256', $rawBody, $this->webhookSecret);
    }

    private function header(array $headers, string $name): ?string
    {
        foreach ($headers as $key => $value) {
            if (strtolower((string) $key) === $name) {
                $value = is_array($value) ? ($value[0] ?? null) : $value;

                return is_string($value) ? $value : null;
            }
        }

        return null;
    }
}
