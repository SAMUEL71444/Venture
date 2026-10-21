<?php

namespace App\Modules\auth\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Tautan verifikasi email kampus, versi HTML dan teks biasa (Bahasa Indonesia). */
final class CampusEmailVerificationMail extends Mailable
{
    use Queueable;

    public function __construct(
        public readonly string $verificationUrl,
        public readonly int $ttlMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Verifikasi email kampus Digital.in');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.auth.campus-email-verification',
            text: 'mail.auth.campus-email-verification-text',
            with: ['url' => $this->verificationUrl, 'ttlMinutes' => $this->ttlMinutes],
        );
    }
}
