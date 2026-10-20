<?php

namespace App\Modules\payment\Gateway;

final class GatewayEvent
{
    public const PAID = 'PAID';

    public const FAILED = 'FAILED';

    public const EXPIRED = 'EXPIRED';

    /**
     * @param  string  $status  PAID | FAILED | EXPIRED | status lain dari gateway (diabaikan)
     * @param  int|null  $grossAmount  total yang dibayar UMKM (nilai project + biaya gateway)
     */
    public function __construct(
        public readonly string $gatewayRef,
        public readonly string $status,
        public readonly ?int $grossAmount,
        public readonly string $eventType,
        public readonly array $payload,
    ) {}
}
