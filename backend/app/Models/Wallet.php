<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Wallet extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'type',
        'balance',
        'pending_withdrawal',
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'integer',
            'pending_withdrawal' => 'integer',
        ];
    }
}
