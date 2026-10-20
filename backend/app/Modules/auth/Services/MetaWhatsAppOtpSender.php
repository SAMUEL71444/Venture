<?php

namespace App\Modules\auth\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

final class MetaWhatsAppOtpSender
{
    public function send(string $phone, string $code): void
    {
        $baseUrl = rtrim((string) config('services.meta_whatsapp.api_base_url'), '/');
        $version = trim((string) config('services.meta_whatsapp.api_version'), '/');
        $phoneNumberId = config('services.meta_whatsapp.phone_number_id');
        $accessToken = config('services.meta_whatsapp.access_token');

        if (! $version || ! $phoneNumberId || ! $accessToken) {
            throw new RuntimeException('Meta WhatsApp API credentials are not configured.');
        }

        Http::withToken($accessToken)
            ->acceptJson()
            ->timeout(10)
            ->post("{$baseUrl}/{$version}/{$phoneNumberId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => ltrim(preg_replace('/\D+/', '', $phone), '+'),
                'type' => 'template',
                'template' => [
                    'name' => config('services.meta_whatsapp.otp_template'),
                    'language' => ['code' => config('services.meta_whatsapp.language')],
                    'components' => [[
                        'type' => 'body',
                        'parameters' => [[
                            'type' => 'text',
                            'text' => $code,
                        ]],
                    ]],
                ],
            ])
            ->throw();
    }
}
