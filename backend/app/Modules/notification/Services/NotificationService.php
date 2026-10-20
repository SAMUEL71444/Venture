<?php

namespace App\Modules\notification\Services;

use App\Models\User;
use App\Models\UserNotification;
use App\Modules\notification\Jobs\DeliverNotificationJob;
use Illuminate\Support\Collection;
use InvalidArgumentException;

/**
 * Notifikasi in-app + WhatsApp + email (07 bagian 3). Baris notifications = kanal IN_APP;
 * kanal eksternal dikirim oleh DeliverNotificationJob setelah transaksi commit.
 */
final class NotificationService
{
    public const IN_APP = 'IN_APP';

    public const WHATSAPP = 'WHATSAPP';

    public const EMAIL = 'EMAIL';

    private const CHANNELS = [self::IN_APP, self::WHATSAPP, self::EMAIL];

    /**
     * @param  User|iterable<User>  $recipients
     * @param  list<string>  $channels
     * @return Collection<int, UserNotification>
     */
    public function notify(User|iterable $recipients, string $type, string $title, string $body, array $data = [], array $channels = [self::IN_APP]): Collection
    {
        $channels = array_values(array_unique([self::IN_APP, ...$channels]));
        if (array_diff($channels, self::CHANNELS) !== []) {
            throw new InvalidArgumentException('Unknown notification channel.');
        }

        $external = array_values(array_diff($channels, [self::IN_APP]));
        $users = $recipients instanceof User ? collect([$recipients]) : collect($recipients);

        return $users->filter()->unique('id')->values()->map(function (User $user) use ($type, $title, $body, $data, $channels, $external) {
            $notification = UserNotification::query()->create([
                'user_id' => $user->id,
                'type' => $type,
                'title' => $title,
                'body' => $body,
                'data' => $data,
                'channels' => implode(',', $channels),
                'sent_at' => $external === [] ? now() : null,
            ]);

            if ($external !== []) {
                DeliverNotificationJob::dispatch($notification->id)->afterCommit();
            }

            return $notification;
        });
    }

    /** Semua admin aktif (alert belum punya assigned_to). */
    public function notifyAdmins(string $type, string $title, string $body, array $data = [], array $channels = [self::IN_APP, self::EMAIL]): Collection
    {
        $admins = User::query()->where('role', 'ADMIN')->where('status', 'ACTIVE')->get();

        return $this->notify($admins, $type, $title, $body, $data, $channels);
    }
}
