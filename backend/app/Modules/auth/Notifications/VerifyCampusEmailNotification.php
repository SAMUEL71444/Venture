<?php

namespace App\Modules\auth\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Dikirim lewat queue setelah transaksi commit: kegagalan mailer tidak lagi membuat registrasi
 * mengembalikan 500 setelah akun tersimpan (audit F4). Mahasiswa bisa meminta kirim ulang.
 */
final class VerifyCampusEmailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly string $verificationUrl)
    {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Verifikasi email kampus Digital.in')
            ->greeting('Verifikasi email kampus Anda')
            ->line('Gunakan tautan berikut untuk menyelesaikan verifikasi mahasiswa.')
            ->action('Verifikasi email kampus', $this->verificationUrl)
            ->line('Tautan berlaku selama 60 menit dan hanya dapat digunakan sekali.');
    }
}
