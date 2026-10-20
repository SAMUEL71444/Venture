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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
