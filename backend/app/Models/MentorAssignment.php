<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MentorAssignment extends Model
{
    use HasUuids;

    protected $fillable = [
        'milestone_id',
        'mentor_id',
        'status',
        'review_count',
        'fee_eligible',
        'fee_amount',
        'fee_paid_at',
        'assigned_at',
        'replaced_at',
    ];

    protected function casts(): array
    {
        return [
            'review_count' => 'integer',
            'fee_eligible' => 'boolean',
            'fee_amount' => 'integer',
            'assigned_at' => 'datetime',
            'fee_paid_at' => 'datetime',
            'replaced_at' => 'datetime',
        ];
    }

    public function milestone(): BelongsTo
    {
        return $this->belongsTo(Milestone::class, 'milestone_id');
    }

    public function mentor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mentor_id');
    }
}
