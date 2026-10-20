<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Application extends Model
{
    use HasUuids;

    protected $fillable = [
        'project_id',
        'student_id',
        'invitation_id',
        'proposal',
        'offered_price',
        'estimated_days',
        'proposed_milestones',
        'match_score',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'offered_price' => 'integer',
            'estimated_days' => 'integer',
            'match_score' => 'integer',
            'proposed_milestones' => 'array',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function invitation(): BelongsTo
    {
        return $this->belongsTo(Invitation::class, 'invitation_id');
    }
}
