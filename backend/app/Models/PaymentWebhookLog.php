<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PaymentWebhookLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'gateway',
        'gateway_ref',
        'event_type',
        'payload',
        'processed',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'processed' => 'boolean',
            'received_at' => 'datetime',
        ];
    }
}
