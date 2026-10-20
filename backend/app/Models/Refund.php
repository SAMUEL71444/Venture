<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Refund extends Model
{
    use HasUuids;

    protected $fillable = [
        'payment_id',
        'cancellation_request_id',
        'amount',
        'status',
        'gateway_ref',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
        ];
    }
}
