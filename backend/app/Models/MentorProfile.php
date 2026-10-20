<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class MentorProfile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'title', 'institution', 'bio', 'verification_status', 'max_active_reviews', 'is_available', 'rating_avg',
    ];

    protected function casts(): array
    {
        return [
            'max_active_reviews' => 'integer',
            'is_available' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function expertises(): BelongsToMany
    {
        return $this->belongsToMany(ServiceCategory::class, 'mentor_expertises', 'mentor_id', 'category_id');
    }
}
