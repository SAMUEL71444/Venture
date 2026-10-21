<?php

namespace App\Shared\Exceptions;

use RuntimeException;

final class BusinessRuleViolation extends RuntimeException
{
    /**
     * `$errorCode` = kode spesifik di respons API (mis. OTP_EXPIRED). Default tetap
     * BUSINESS_RULE_VIOLATION supaya modul lain tidak berubah.
     */
    public function __construct(
        string $message,
        public readonly array $details = [],
        public readonly string $errorCode = 'BUSINESS_RULE_VIOLATION',
    ) {
        parent::__construct($message);
    }
}
