<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    use HasUuids;

    protected $fillable = ['conversation_id', 'sender_id', 'body', 'attachment_url', 'is_flagged', 'read_at'];

    protected function casts(): array
    {
        return [
            'is_flagged' => 'boolean',
            'read_at' => 'datetime',
        ];
    }
}
