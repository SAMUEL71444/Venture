<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CancellationAllocation extends Model
{
    use HasUuids;

    protected $fillable = [
        'cancellation_request_id',
        'milestone_id',
        'amount_to_student',
        'amount_to_umkm',
        'mentor_fee',
    ];

    protected function casts(): array
    {
        return [
            'amount_to_student' => 'integer',
            'amount_to_umkm' => 'integer',
            'mentor_fee' => 'integer',
        ];
    }
}
