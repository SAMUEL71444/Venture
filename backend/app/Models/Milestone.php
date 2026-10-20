<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Milestone extends Model
{
    use HasUuids;

    protected $fillable = [
        'contract_id',
        'sequence',
        'title',
        'description',
        'amount',
        'due_date',
        'mentor_id',
        'status',
        'revision_count',
        'mentor_return_count',
        'max_revisions',
        'max_mentor_returns',
        'started_at',
        'client_review_started_at',
        'client_review_paused_seconds',
        'approved_at',
        'approved_via',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'sequence' => 'integer',
            'revision_count' => 'integer',
            'mentor_return_count' => 'integer',
            'max_revisions' => 'integer',
            'max_mentor_returns' => 'integer',
            'due_date' => 'date',
            'started_at' => 'datetime',
            'client_review_started_at' => 'datetime',
            'client_review_paused_seconds' => 'integer',
            'approved_at' => 'datetime',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(Submission::class, 'milestone_id');
    }

    public function mentorAssignments(): HasMany
    {
        return $this->hasMany(MentorAssignment::class, 'milestone_id');
    }
}
