<?php

namespace App\Modules\auth\Notifications;

use App\Modules\auth\Mail\CampusEmailVerificationMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
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

    /** Templat sendiri (HTML + teks, Bahasa Indonesia) menggantikan MailMessage bawaan yang berteks Inggris. */
    public function toMail(object $notifiable): CampusEmailVerificationMail
    {
        return (new CampusEmailVerificationMail($this->verificationUrl, (int) config('auth.email_verification_ttl_minutes', 60)))
            ->to($notifiable->routeNotificationFor('mail', $this));
    }
}
