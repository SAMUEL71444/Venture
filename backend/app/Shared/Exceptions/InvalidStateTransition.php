<?php

namespace App\Shared\Exceptions;

use RuntimeException;

final class InvalidStateTransition extends RuntimeException
{
    public function __construct(string $message, public readonly array $details = [])
    {
        parent::__construct($message);
    }
}
