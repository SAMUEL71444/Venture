<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'payment_gateway' => [
        // mock = gateway lokal untuk dev/test (Batas Keamanan: layanan eksternal pakai mock).
        // Driver Midtrans/Xendit ditambahkan saat gateway dipilih.
        'driver' => env('PAYMENT_GATEWAY_DRIVER', 'mock'),
        // Wajib diisi. Webhook ditolak (fail closed) jika kosong.
        'webhook_secret' => env('PAYMENT_WEBHOOK_SECRET'),
        // Tarif biaya gateway (ditanggung UMKM) untuk driver mock: flat Rupiah + basis poin (1 bp = 0,01%).
        'mock_fees' => [
            'VA' => ['flat' => 4000, 'bp' => 0],
            'QRIS' => ['flat' => 0, 'bp' => 70],
            'EWALLET' => ['flat' => 0, 'bp' => 150],
        ],
    ],

    'disbursement' => [
        // mock = disbursement lokal untuk dev/test. Driver gateway asli ditambahkan saat gateway dipilih.
        'driver' => env('DISBURSEMENT_DRIVER', 'mock'),
        // Wajib diisi. Webhook disbursement ditolak (fail closed) jika kosong.
        'webhook_secret' => env('DISBURSEMENT_WEBHOOK_SECRET'),
        // Tarif transfer mock (Rupiah), dipakai jika setting withdrawal_fee kosong.
        'mock_fees' => ['BANK' => 2500, 'EWALLET' => 1000],
    ],

    'meta_whatsapp' => [
        'api_base_url' => env('META_WHATSAPP_API_BASE_URL', 'https://graph.facebook.com'),
        'api_version' => env('WHATSAPP_API_VERSION'),
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'access_token' => env('WHATSAPP_ACCESS_TOKEN'),
        'otp_template' => env('WHATSAPP_OTP_TEMPLATE', 'otp_verification'),
        'language' => env('WHATSAPP_TEMPLATE_LANGUAGE', 'id'),
        // Template Authentication dengan tombol "Salin kode" butuh parameter tombol.
        'otp_copy_code_button' => (bool) env('WHATSAPP_OTP_COPY_CODE_BUTTON', true),
    ],

];
