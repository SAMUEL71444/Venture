<?php

namespace App\Modules\auth\Services;

use InvalidArgumentException;

/**
 * Memilih pengirim OTP per kanal (tidak lagi berdasarkan APP_ENV untuk email):
 * - email: mailer Laravel (EmailOtpSender), kecuali MAIL_MAILER=log → kode ditulis
 *   ke log lewat LogOtpSender (hanya diizinkan saat APP_ENV=local).
 * - WhatsApp: Meta Cloud API bila kredensialnya lengkap; jika kosong → LogOtpSender
 *   (hanya diizinkan saat APP_ENV=local; di luar itu gagal → SERVICE_UNAVAILABLE).
 */
final class OtpDelivery
{
    public function __construct(
        private readonly MetaWhatsAppOtpSender $whatsapp,
        private readonly EmailOtpSender $email,
        private readonly LogOtpSender $log,
    ) {}

    public function send(string $channel, string $identifier, string $code, string $purpose): void
    {
        match ($channel) {
            OtpService::CHANNEL_EMAIL => $this->usesLogMailer()
                ? $this->log->send($channel, $identifier, $code, $purpose)
                : $this->email->send($identifier, $code, $purpose),
            OtpService::CHANNEL_WHATSAPP => $this->whatsapp->isConfigured()
                ? $this->whatsapp->send($identifier, $code)
                : $this->log->send($channel, $identifier, $code, $purpose),
            default => throw new InvalidArgumentException("Unknown OTP channel [{$channel}]."),
        };
    }

    private function usesLogMailer(): bool
    {
        return config('mail.default') === 'log';
    }
}
