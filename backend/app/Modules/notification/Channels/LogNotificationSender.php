<?php

namespace App\Modules\notification\Channels;

use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Log;

/**
 * Pengirim mock: menulis ke log. Template WhatsApp bisnis & email transaksional
 * ditambahkan saat layanan aslinya dikonfigurasi (Batas Keamanan: layanan eksternal pakai mock).
 */
final class LogNotificationSender implements NotificationChannelSender
{
    public function send(UserNotification $notification, User $recipient, string $channel): void
    {
        Log::info('notification.sent', [
            'channel' => $channel,
            'notification_id' => $notification->id,
            'user_id' => $recipient->id,
            'type' => $notification->type,
        ]);
    }
}
