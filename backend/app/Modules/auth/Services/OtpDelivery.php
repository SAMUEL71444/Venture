<?php

namespace App\Modules\auth\Services;

use InvalidArgumentException;

/**
 * Memilih pengirim OTP per kanal. Saat APP_ENV=local kedua kanal ditulis ke log;
 * di luar itu WhatsApp lewat Meta Cloud API dan email lewat mailer Laravel.
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
        if (app()->environment('local')) {
            $this->log->send($channel, $identifier, $code, $purpose);

            return;
        }

        match ($channel) {
            OtpService::CHANNEL_WHATSAPP => $this->whatsapp->send($identifier, $code),
            OtpService::CHANNEL_EMAIL => $this->email->send($identifier, $code, $purpose),
            default => throw new InvalidArgumentException("Unknown OTP channel [{$channel}]."),
        };
    }
}
