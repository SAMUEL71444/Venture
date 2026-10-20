<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CancellationRequest extends Model
{
    use HasUuids;

    protected $fillable = [
        'contract_id',
        'requested_by',
        'requester_role',
        'type',
        'reason',
        'evidence_urls',
        'counterparty_response',
        'status',
        'resolved_by',
        'admin_notes',
        'response_due_at',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'evidence_urls' => 'array',
            'response_due_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function contract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'contract_id');
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(CancellationAllocation::class, 'cancellation_request_id');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(Refund::class, 'cancellation_request_id');
    }
}
