<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Escrow extends Model
{
    use HasUuids;

    protected $fillable = [
        'contract_id',
        'payment_id',
        'funded_amount',
        'released_amount',
        'refunded_amount',
        'held_amount',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'funded_amount' => 'integer',
            'released_amount' => 'integer',
            'refunded_amount' => 'integer',
            'held_amount' => 'integer',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class);
    }
}
