<?php

namespace App\Modules\payout\Gateway;

use App\Models\BankAccount;
use App\Models\Payout;
use App\Shared\Exceptions\BusinessRuleViolation;
use Illuminate\Support\Str;
use JsonException;
use RuntimeException;

/**
 * Disbursement lokal untuk dev & test: rekening selalu valid, transfer berstatus PROCESSING
 * lalu diselesaikan lewat webhook bertanda tangan HMAC-SHA256 (header X-Signature).
 * Payload webhook: {"gateway_ref": "...", "status": "SUCCESS|FAILED"}
 */
final class MockDisbursementGateway implements DisbursementGateway
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

    public function quoteFee(string $channel): int
    {
        if (! isset($this->fees[$channel])) {
            throw new BusinessRuleViolation("Disbursement channel [{$channel}] is not supported.");
        }

        return (int) $this->fees[$channel];
    }

    public function validateAccount(BankAccount $account): bool
    {
        return true;
    }

    public function disburse(Payout $payout, BankAccount $account): DisbursementResult
    {
        return new DisbursementResult('MOCK-DS-'.Str::upper(Str::random(16)), DisbursementResult::PROCESSING);
    }

    public function verifyWebhook(string $rawBody, array $headers): bool
    {
        $signature = null;
        foreach ($headers as $key => $value) {
            if (strtolower((string) $key) === self::SIGNATURE_HEADER) {
                $signature = is_array($value) ? ($value[0] ?? null) : $value;
            }
        }

        return is_string($signature) && hash_equals($this->sign($rawBody), $signature);
    }

    public function parseWebhook(string $rawBody): array
    {
        try {
            $payload = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw new BusinessRuleViolation('Webhook payload is not valid JSON.');
        }

        if (! is_string($payload['gateway_ref'] ?? null) || ! in_array($payload['status'] ?? null, ['SUCCESS', 'FAILED'], true)) {
            throw new BusinessRuleViolation('Webhook payload must contain gateway_ref and status SUCCESS|FAILED.');
        }

        return ['gateway_ref' => $payload['gateway_ref'], 'status' => $payload['status']];
    }

    public function sign(string $rawBody): string
    {
        if (blank($this->webhookSecret)) {
            throw new RuntimeException('DISBURSEMENT_WEBHOOK_SECRET is not configured.');
        }

        return hash_hmac('sha256', $rawBody, $this->webhookSecret);
    }
}
