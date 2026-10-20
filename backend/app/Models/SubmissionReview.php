<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SubmissionReview extends Model
{
    use HasUuids;

    protected $fillable = [
        'submission_id',
        'reviewer_id',
        'reviewer_role',
        'decision',
        'feedback',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'reviewed_at' => 'datetime',
        ];
    }
}
