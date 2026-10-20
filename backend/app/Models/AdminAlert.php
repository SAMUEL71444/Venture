<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AdminAlert extends Model
{
    use HasUuids;

    protected $fillable = [
        'type',
        'severity',
        'reference_type',
        'reference_id',
        'status',
        'assigned_to',
        'follow_up_deadline',
        'resolution_notes',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'follow_up_deadline' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(AlertFollowUp::class, 'alert_id');
    }
}
