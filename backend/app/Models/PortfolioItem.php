<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PortfolioItem extends Model
{
    use HasUuids;

    protected $fillable = ['student_id', 'contract_id', 'title', 'description', 'media_urls', 'is_verified'];

    protected function casts(): array
    {
        return [
            'media_urls' => 'array',
            'is_verified' => 'boolean',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(StudentProfile::class, 'student_id');
    }
}
