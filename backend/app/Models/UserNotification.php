<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/** Tabel NOTIFICATIONS (ERD bagian 4). Dinamai UserNotification agar tidak bentrok dengan Notification Laravel. */
class UserNotification extends Model
{
    use HasUuids;

    protected $table = 'notifications';

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'body',
        'data',
        'channels',
        'sent_at',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'sent_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    /** @return list<string> */
    public function channelList(): array
    {
        return array_values(array_filter(explode(',', (string) $this->channels)));
    }
}
