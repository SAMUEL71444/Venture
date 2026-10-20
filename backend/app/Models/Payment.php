<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasUuids;

    protected $fillable = [
        'payer_id',
        'purpose',
        'reference_id',
        'reference_type',
        'amount',
        'gateway_fee',
        'gateway',
        'gateway_ref',
        'method',
        'checkout_url',
        'status',
        'expires_at',
        'paid_at',
    ];

    protected $appends = ['total_charged'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'gateway_fee' => 'integer',
            'expires_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    /** Yang dibayar UMKM: nilai project + biaya layanan pembayaran (ditanggung UMKM). */
    public function getTotalChargedAttribute(): int
    {
        return (int) $this->amount + (int) $this->gateway_fee;
    }
}
