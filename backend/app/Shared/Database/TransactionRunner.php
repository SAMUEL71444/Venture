<?php

namespace App\Shared\Database;

use Closure;
use Illuminate\Support\Facades\DB;

final class TransactionRunner
{
    public function run(Closure $callback, int $attempts = 3): mixed
    {
        return DB::transaction($callback, $attempts);
    }
}
