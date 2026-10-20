<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Rating extends Model
{
    use HasUuids;

    protected $fillable = ['contract_id', 'rater_id', 'ratee_id', 'direction', 'score', 'comment'];

    protected function casts(): array
    {
        return ['score' => 'integer'];
    }
}
