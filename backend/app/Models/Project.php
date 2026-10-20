<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasUuids;

    protected $fillable = [
        'umkm_id',
        'category_id',
        'template_id',
        'title',
        'description',
        'budget_min',
        'budget_max',
        'deadline',
        'city',
        'status',
        'published_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'deadline' => 'date',
            'published_at' => 'datetime',
            'closed_at' => 'datetime',
            'budget_min' => 'integer',
            'budget_max' => 'integer',
        ];
    }

    public function umkm(): BelongsTo
    {
        return $this->belongsTo(User::class, 'umkm_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'category_id');
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(ProjectTemplate::class, 'template_id');
    }

    public function applications(): HasMany
    {
        return $this->hasMany(Application::class, 'project_id');
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(Invitation::class, 'project_id');
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'project_id');
    }

    public function premiumListings(): HasMany
    {
        return $this->hasMany(PremiumListing::class, 'project_id');
    }

    /** Premium listing yang sedang berlaku (tampil lebih dulu di daftar project). */
    public function scopeWithPremiumFlag($query)
    {
        $now = now();

        return $query->withExists(['premiumListings as is_premium' => fn ($q) => $q->where('status', 'ACTIVE')
            ->where('starts_at', '<=', $now)->where('ends_at', '>', $now)]);
    }
}
