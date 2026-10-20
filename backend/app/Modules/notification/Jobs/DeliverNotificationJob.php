<?php

namespace App\Modules\notification\Jobs;

use App\Models\User;
use App\Models\UserNotification;
use App\Modules\notification\Channels\NotificationChannelSender;
use App\Modules\notification\Services\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

final class DeliverNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public readonly string $notificationId) {}

    public function handle(NotificationChannelSender $sender): void
    {
        $notification = UserNotification::query()->find($this->notificationId);
        if (! $notification || $notification->sent_at) {
            return;
        }

        $recipient = User::query()->find($notification->user_id);
        if (! $recipient) {
            return;
        }

        foreach (array_diff($notification->channelList(), [NotificationService::IN_APP]) as $channel) {
            $sender->send($notification, $recipient, $channel);
        }

        $notification->forceFill(['sent_at' => now()])->save();
    }
}
