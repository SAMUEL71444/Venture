<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class MilestoneSettlement extends Model
{
    use HasUuids;

    protected $fillable = [
        'milestone_id',
        'gross_amount',
        'platform_fee',
        'mentor_fee',
        'platform_net',
        'student_amount',
        'refund_amount',
        'ledger_transaction_id',
        'settled_at',
    ];

    protected function casts(): array
    {
        return [
            'gross_amount' => 'integer',
            'platform_fee' => 'integer',
            'mentor_fee' => 'integer',
            'platform_net' => 'integer',
            'student_amount' => 'integer',
            'refund_amount' => 'integer',
            'settled_at' => 'datetime',
        ];
    }
}
