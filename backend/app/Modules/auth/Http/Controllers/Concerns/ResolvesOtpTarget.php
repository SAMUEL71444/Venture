<?php

namespace App\Modules\auth\Http\Controllers\Concerns;

use App\Modules\auth\Services\OtpService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

trait ResolvesOtpTarget
{
    /**
     * Validasi `{ channel, identifier }`; email dinormalisasi ke huruf kecil,
     * WhatsApp wajib E.164. Klien lama yang mengirim `{ phone }` tetap diterima.
     *
     * @return array{0: string, 1: string, 2: array<string, mixed>}
     */
    protected function validateOtpTarget(Request $request, array $extraRules = []): array
    {
        if (! $request->filled('identifier') && $request->filled('phone')) {
            $request->merge([
                'channel' => $request->input('channel', OtpService::CHANNEL_WHATSAPP),
                'identifier' => $request->input('phone'),
            ]);
        }

        $channel = $request->input('channel');

        if (is_string($request->input('identifier')) && in_array($channel, OtpService::CHANNELS, true)) {
            $request->merge(['identifier' => OtpService::normalize($channel, $request->input('identifier'))]);
        }

        $input = $request->validate([
            'channel' => ['required', 'string', Rule::in(OtpService::CHANNELS)],
            'identifier' => [
                'required', 'string', 'max:255',
                $channel === OtpService::CHANNEL_EMAIL ? 'email:rfc' : 'regex:'.OtpService::PHONE_PATTERN,
            ],
            ...$extraRules,
        ]);

        return [$input['channel'], $input['identifier'], $input];
    }
}
