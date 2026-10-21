<?php

namespace App\Modules\auth\Mail;

use App\Modules\auth\Services\OtpService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Email kode OTP (registrasi / reset password), versi HTML dan teks biasa. */
final class OtpCodeMail extends Mailable
{
    use Queueable;

    public function __construct(
        public readonly string $code,
        public readonly string $purpose,
        public readonly int $ttlMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->isReset()
            ? 'Kode reset kata sandi Digital.in'
            : 'Kode verifikasi Digital.in');
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.auth.otp-code',
            text: 'mail.auth.otp-code-text',
            with: [
                'code' => $this->code,
                'ttlMinutes' => $this->ttlMinutes,
                'intro' => $this->isReset()
                    ? 'Gunakan kode berikut untuk mengatur ulang kata sandi akun Digital.in kamu.'
                    : 'Gunakan kode berikut untuk memverifikasi pendaftaran akun Digital.in kamu.',
            ],
        );
    }

    private function isReset(): bool
    {
        return $this->purpose === OtpService::PURPOSE_PASSWORD_RESET;
    }
}
