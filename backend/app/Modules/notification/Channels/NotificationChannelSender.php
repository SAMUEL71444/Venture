<?php

namespace App\Modules\notification\Channels;

use App\Models\User;
use App\Models\UserNotification;

interface NotificationChannelSender
{
    /** Kirim satu notifikasi lewat kanal eksternal (WHATSAPP / EMAIL). Lempar exception jika gagal. */
    public function send(UserNotification $notification, User $recipient, string $channel): void;
}
