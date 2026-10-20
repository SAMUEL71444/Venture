<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class University extends Model
{
    use HasUuids;

    protected $fillable = ['name', 'email_domain', 'city', 'is_partner'];

    protected function casts(): array
    {
        return ['is_partner' => 'boolean'];
    }
}
