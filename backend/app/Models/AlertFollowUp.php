<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AlertFollowUp extends Model
{
    use HasUuids;

    protected $fillable = [
        'alert_id',
        'admin_id',
        'channel',
        'outcome',
        'notes',
        'followed_up_at',
    ];

    protected function casts(): array
    {
        return [
            'followed_up_at' => 'datetime',
        ];
    }
}
