<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OtpCode extends Model
{
    use HasUuids;

    protected $fillable = [
        'channel',
        'identifier',
        'phone',
        'code_hash',
        'purpose',
        'attempt_count',
        'verification_token_hash',
        'verified_at',
        'verification_expires_at',
        'expires_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'attempt_count' => 'integer',
            'verified_at' => 'datetime',
            'verification_expires_at' => 'datetime',
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }
}
