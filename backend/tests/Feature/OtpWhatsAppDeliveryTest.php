<?php

use App\Models\OtpCode;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

function configureMeta(array $overrides = []): void
{
    config(['services.meta_whatsapp' => [
        'api_base_url' => 'https://graph.facebook.com',
        'api_version' => 'v22.0',
        'phone_number_id' => '123456789',
        'access_token' => 'test-access-token',
        'otp_template' => 'digitalin_otp',
        'language' => 'id',
        'otp_copy_code_button' => true,
        ...$overrides,
    ]]);
}

function sendWhatsAppOtp()
{
    return test()->postJson('/api/v1/auth/otp/send', ['channel' => 'whatsapp', 'identifier' => '+6281234567890']);
}

it('sends an Authentication template with the code in the body and copy-code button when Meta is configured', function () {
    configureMeta();
    Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.1']]])]);
    Log::spy();

    sendWhatsAppOtp()->assertAccepted();

    Http::assertSent(function (Request $request) {
        $template = $request['template'];
        $code = $template['components'][0]['parameters'][0]['text'];

        return $request->url() === 'https://graph.facebook.com/v22.0/123456789/messages'
            && $request->hasHeader('Authorization', 'Bearer test-access-token')
            && $request['messaging_product'] === 'whatsapp'
            && $request['to'] === '6281234567890'
            && $request['type'] === 'template'
            && $template['name'] === 'digitalin_otp'
            && $template['language'] === ['code' => 'id']
            && preg_match('/^\d{6}$/', $code)
            && $template['components'][0]['type'] === 'body'
            && $template['components'][1] === [
                'type' => 'button', 'sub_type' => 'url', 'index' => '0',
                'parameters' => [['type' => 'text', 'text' => $code]],
            ];
    });
    // Kode tidak ditulis ke log saat pengirim Meta dipakai.
    Log::shouldNotHaveReceived('info');
});

it('omits the button parameter when the copy-code button is disabled', function () {
    configureMeta(['otp_copy_code_button' => false]);
    Http::fake(['graph.facebook.com/*' => Http::response(['messages' => [['id' => 'wamid.1']]])]);

    sendWhatsAppOtp()->assertAccepted();

    Http::assertSent(fn (Request $request) => count($request['template']['components']) === 1);
});

it('falls back to the log sender when Meta credentials are empty', function () {
    configureMeta(['access_token' => null]);
    Http::fake();
    Log::spy();
    app()->detectEnvironment(fn () => 'local');

    sendWhatsAppOtp()->assertAccepted();

    Http::assertNothingSent();
    Log::shouldHaveReceived('info')->withArgs(fn (string $message) => str_starts_with($message, '[OTP lokal] whatsapp +6281234567890 (REGISTER): '))->once();
});

it('fails closed outside the local environment when Meta credentials are empty', function () {
    configureMeta(['phone_number_id' => null]);
    Http::fake();
    Log::spy();

    sendWhatsAppOtp()->assertStatus(503)->assertJsonPath('error.code', 'SERVICE_UNAVAILABLE');

    Http::assertNothingSent();
    Log::shouldNotHaveReceived('info');
    expect(OtpCode::query()->count())->toBe(0);
});

it('returns SERVICE_UNAVAILABLE and logs the Meta error without the OTP', function (int $status, array $error, string $expected) {
    configureMeta();
    $code = null;
    Http::fake(function (Request $request) use (&$code, $status, $error) {
        $code = $request['template']['components'][0]['parameters'][0]['text'];

        return Http::response(['error' => $error], $status);
    });
    Log::spy();

    sendWhatsAppOtp()->assertStatus(503)->assertJsonPath('error.code', 'SERVICE_UNAVAILABLE');

    expect(OtpCode::query()->count())->toBe(0);
    Log::shouldHaveReceived('error')->withArgs(function (string $message, array $context) use (&$code, $expected) {
        return $message === 'OTP delivery failed.'
            && $context['channel'] === 'whatsapp'
            && str_contains($context['error'], $expected)
            && ! str_contains(json_encode($context), $code);
    })->once();
    Log::shouldNotHaveReceived('info');
})->with([
    'token kedaluwarsa' => [401, ['message' => 'Error validating access token: Session has expired.', 'type' => 'OAuthException', 'code' => 190, 'error_subcode' => 463], 'Session has expired'],
    'nomor belum terdaftar (mode tes)' => [400, ['message' => '(#131030) Recipient phone number not in allowed list', 'code' => 131030, 'error_data' => ['details' => 'Recipient phone number not in allowed list']], 'not in allowed list'],
    'template belum disetujui' => [404, ['message' => '(#132001) Template name does not exist in the translation', 'code' => 132001], 'Template name does not exist'],
]);
