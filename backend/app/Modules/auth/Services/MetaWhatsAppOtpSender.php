<?php

namespace App\Modules\auth\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Kirim OTP lewat WhatsApp Cloud API memakai template kategori Authentication:
 * kode sebagai parameter body, plus parameter tombol "Salin kode" (copy code,
 * sub_type url, index 0) bila WHATSAPP_OTP_COPY_CODE_BUTTON=true (default).
 * Galat dari Meta dilempar sebagai RuntimeException berisi pesan Meta — tanpa kode OTP.
 */
final class MetaWhatsAppOtpSender
{
    /** Kredensial lengkap → pengirim ini dipakai; selain itu OtpDelivery jatuh ke LogOtpSender. */
    public function isConfigured(): bool
    {
        return (bool) (config('services.meta_whatsapp.api_version')
            && config('services.meta_whatsapp.phone_number_id')
            && config('services.meta_whatsapp.access_token')
            && config('services.meta_whatsapp.otp_template'));
    }

    public function send(string $phone, string $code): void
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Meta WhatsApp API credentials are not configured.');
        }

        $baseUrl = rtrim((string) config('services.meta_whatsapp.api_base_url'), '/');
        $version = trim((string) config('services.meta_whatsapp.api_version'), '/');
        $phoneNumberId = config('services.meta_whatsapp.phone_number_id');

        $components = [[
            'type' => 'body',
            'parameters' => [['type' => 'text', 'text' => $code]],
        ]];

        if (config('services.meta_whatsapp.otp_copy_code_button')) {
            $components[] = [
                'type' => 'button',
                'sub_type' => 'url',
                'index' => '0',
                'parameters' => [['type' => 'text', 'text' => $code]],
            ];
        }

        $response = Http::withToken(config('services.meta_whatsapp.access_token'))
            ->acceptJson()
            ->timeout(10)
            ->post("{$baseUrl}/{$version}/{$phoneNumberId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => ltrim(preg_replace('/\D+/', '', $phone), '+'),
                'type' => 'template',
                'template' => [
                    'name' => config('services.meta_whatsapp.otp_template'),
                    'language' => ['code' => config('services.meta_whatsapp.language')],
                    'components' => $components,
                ],
            ]);

        if ($response->failed()) {
            // Mis. token kedaluwarsa (190), nomor belum terdaftar di mode tes (131030),
            // template belum disetujui / parameter tidak cocok (132000, 132001).
            $error = (array) $response->json('error', []);
            throw new RuntimeException(sprintf(
                'Meta WhatsApp API error (HTTP %d, code %s%s): %s%s',
                $response->status(),
                $error['code'] ?? '-',
                isset($error['error_subcode']) ? ', subcode '.$error['error_subcode'] : '',
                $error['message'] ?? 'unknown error',
                isset($error['error_data']['details']) ? ' — '.$error['error_data']['details'] : '',
            ));
        }
    }
}
