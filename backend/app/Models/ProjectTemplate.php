<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectTemplate extends Model
{
    use HasUuids;

    protected $fillable = [
        'category_id',
        'title',
        'description',
        'default_milestones',
        'suggested_budget_min',
        'suggested_budget_max',
        'suggested_duration_days',
    ];

    protected function casts(): array
    {
        return [
            'default_milestones' => 'array',
            'suggested_budget_min' => 'integer',
            'suggested_budget_max' => 'integer',
            'suggested_duration_days' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'category_id');
    }
}
