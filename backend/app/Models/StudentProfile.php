<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudentProfile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'university_id', 'university_name_custom', 'nim', 'major', 'semester', 'campus_email', 'campus_email_verified_at', 'ktm_file_url', 'verification_attempts', 'ktm_submitted_at',
        'verification_status', 'verified_by', 'bio', 'rating_avg', 'completed_contracts_count',
        'active_contracts_count', 'is_available',
    ];

    /** Path file KTM di private storage & ID admin verifikator tidak dikirim ke klien (audit F26). */
    protected $hidden = ['ktm_file_url', 'verified_by'];

    protected $appends = ['has_ktm'];

    public function getHasKtmAttribute(): bool
    {
        return ! empty($this->attributes['ktm_file_url'] ?? null);
    }

    protected function casts(): array
    {
        return [
            'semester' => 'integer',
            'campus_email_verified_at' => 'datetime',
            'ktm_submitted_at' => 'datetime',
            'verification_attempts' => 'integer',
            'is_available' => 'boolean',
            'completed_contracts_count' => 'integer',
            'active_contracts_count' => 'integer',
            // Kolom decimal: pgsql mengembalikan string ("4.50"), SQLite float. Samakan jadi angka.
            'rating_avg' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function university(): BelongsTo
    {
        return $this->belongsTo(University::class);
    }

    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(ServiceCategory::class, 'student_skills', 'student_id', 'category_id')
            ->withPivot('level');
    }

    public function portfolioItems(): HasMany
    {
        return $this->hasMany(PortfolioItem::class, 'student_id');
    }
}
