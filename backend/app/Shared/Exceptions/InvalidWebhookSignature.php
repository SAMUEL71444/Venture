<?php

namespace App\Shared\Exceptions;

use RuntimeException;

final class InvalidWebhookSignature extends RuntimeException
{
    public function __construct(string $message = 'Invalid webhook signature.')
    {
        parent::__construct($message);
    }
}
