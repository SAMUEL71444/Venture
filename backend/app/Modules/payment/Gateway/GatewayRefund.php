<?php

namespace App\Modules\payment\Gateway;

final class GatewayRefund
{
    public const SUCCESS = 'SUCCESS';

    public const PROCESSING = 'PROCESSING';

    public const FAILED = 'FAILED';

    public function __construct(
        public readonly string $gatewayRef,
        public readonly string $status,
    ) {}
}
