<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UmkmProfile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'business_name', 'business_type', 'address', 'city', 'latitude', 'longitude', 'instagram_url', 'rating_avg',
    ];

    protected function casts(): array
    {
        // Kolom decimal: pgsql mengembalikan string ("-6.2000000"), SQLite float. Samakan jadi angka.
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'rating_avg' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
