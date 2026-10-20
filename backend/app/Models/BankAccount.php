<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BankAccount extends Model
{
    use HasUuids;

    protected $fillable = ['user_id', 'channel', 'provider_code', 'account_number', 'account_number_last4', 'account_holder_name', 'is_verified', 'is_primary'];

    /** Nomor rekening penuh tidak pernah dikirim ke klien. */
    protected $hidden = ['account_number'];

    protected function casts(): array
    {
        return [
            'account_number' => 'encrypted',
            'is_verified' => 'boolean',
            'is_primary' => 'boolean',
        ];
    }
}
