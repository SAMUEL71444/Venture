<?php

namespace App\Console\Commands;

use App\Models\Payout;
use App\Modules\payout\Gateway\DisbursementGateway;
use App\Modules\payout\Gateway\MockDisbursementGateway;
use App\Modules\payout\Services\PayoutService;
use Illuminate\Console\Command;

/** Simulasi webhook disbursement mock: php artisan payouts:mock-complete {payout_id} [--status=SUCCESS|FAILED] */
final class MockDisbursementCommand extends Command
{
    protected $signature = 'payouts:mock-complete {payout : ID payout} {--status=SUCCESS : SUCCESS atau FAILED}';

    protected $description = 'Send a signed mock disbursement webhook for a payout (non-production, mock driver only)';

    public function handle(DisbursementGateway $gateway, PayoutService $payouts): int
    {
        if (app()->isProduction() || ! $gateway instanceof MockDisbursementGateway) {
            $this->error('Only available with the mock disbursement driver outside production.');

            return self::FAILURE;
        }

        $payout = Payout::query()->find($this->argument('payout'));
        if (! $payout?->gateway_ref) {
            $this->error('Payout not found or not yet sent to the disbursement provider.');

            return self::FAILURE;
        }

        $raw = json_encode(['gateway_ref' => $payout->gateway_ref, 'status' => strtoupper((string) $this->option('status'))], JSON_THROW_ON_ERROR);
        $result = $payouts->handleWebhook($raw, [MockDisbursementGateway::SIGNATURE_HEADER => $gateway->sign($raw)]);
        $this->info("Payout {$payout->id}: {$result['status']}");

        return self::SUCCESS;
    }
}
