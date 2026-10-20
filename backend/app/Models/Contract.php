<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Contract extends Model
{
    use HasUuids;

    /** Status yang dihitung sebagai "kontrak aktif" (README aturan 13). */
    public const ACTIVE_STATUSES = ['AWAITING_PAYMENT', 'FUNDED', 'IN_PROGRESS', 'CANCELLATION_REQUESTED'];

    protected $fillable = [
        'contract_no',
        'project_id',
        'application_id',
        'umkm_id',
        'student_id',
        'total_amount',
        'platform_fee_pct',
        'mentor_share_pct',
        'mentor_min_fee',
        'status',
        'payment_due_at',
        'funded_at',
        'started_at',
        'completed_at',
        'cancelled_at',
        'cancelled_by',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'integer',
            'platform_fee_pct' => 'decimal:2',
            'mentor_share_pct' => 'decimal:2',
            'mentor_min_fee' => 'integer',
            'payment_due_at' => 'datetime',
            'funded_at' => 'datetime',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class, 'application_id');
    }

    public function umkm(): BelongsTo
    {
        return $this->belongsTo(User::class, 'umkm_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(Milestone::class, 'contract_id')->orderBy('sequence');
    }

    public function escrow(): HasOne
    {
        return $this->hasOne(Escrow::class, 'contract_id');
    }

    public static function activeCountForStudent(string $studentUserId): int
    {
        return self::query()
            ->where('student_id', $studentUserId)
            ->whereIn('status', self::ACTIVE_STATUSES)
            ->count();
    }
}
