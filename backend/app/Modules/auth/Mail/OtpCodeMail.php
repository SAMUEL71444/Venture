<?php

namespace App\Modules\auth\Mail;

use App\Modules\auth\Services\OtpService;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

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
        return new Envelope(subject: $this->purpose === OtpService::PURPOSE_PASSWORD_RESET
            ? 'Kode reset kata sandi Digital.in'
            : 'Kode verifikasi Digital.in');
    }

    public function content(): Content
    {
        $intro = $this->purpose === OtpService::PURPOSE_PASSWORD_RESET
            ? 'Gunakan kode berikut untuk mengatur ulang kata sandi akun Digital.in kamu.'
            : 'Gunakan kode berikut untuk memverifikasi pendaftaran akun Digital.in kamu.';
        $code = e($this->code);

        return new Content(htmlString: <<<HTML
            <p>{$intro}</p>
            <p style="font-size:24px;font-weight:700;letter-spacing:6px">{$code}</p>
            <p>Kode berlaku {$this->ttlMinutes} menit. Jangan bagikan kode ini kepada siapa pun, termasuk pihak yang mengaku dari Digital.in.</p>
            <p>Abaikan email ini jika kamu tidak merasa memintanya.</p>
            HTML);
    }
}
