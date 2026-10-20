<?php

namespace App\Modules\payment\Gateway;

final class GatewayCharge
{
    public function __construct(
        public readonly string $gatewayRef,
        public readonly ?string $checkoutUrl,
    ) {}
}
