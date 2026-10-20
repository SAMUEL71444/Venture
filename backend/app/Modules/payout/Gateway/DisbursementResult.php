<?php

namespace App\Modules\payout\Gateway;

final class DisbursementResult
{
    public const PROCESSING = 'PROCESSING';

    public const SUCCESS = 'SUCCESS';

    public const FAILED = 'FAILED';

    public function __construct(
        public readonly ?string $gatewayRef,
        public readonly string $status,
    ) {}
}
