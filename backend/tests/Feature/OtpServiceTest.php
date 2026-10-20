<?php

use App\Models\OtpCode;
use App\Modules\auth\Services\OtpService;
use App\Shared\Exceptions\BusinessRuleViolation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class OtpServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.meta_whatsapp.api_base_url' => 'https://graph.facebook.com',
            'services.meta_whatsapp.api_version' => 'v22.0',
            'services.meta_whatsapp.phone_number_id' => 'test-phone-number-id',
            'services.meta_whatsapp.access_token' => 'test-access-token',
            'services.meta_whatsapp.otp_template' => 'otp_verification',
            'services.meta_whatsapp.language' => 'id',
        ]);
        Http::fake();
    }

    public function test_sends_otp_and_consumes_registration_proof_once(): void
    {
        $service = app(OtpService::class);
        $service->send('+6281234567890');
        $code = '';

        Http::assertSent(function (Request $request) use (&$code) {
            $code = $request->data()['template']['components'][0]['parameters'][0]['text'];

            return $request->url() === 'https://graph.facebook.com/v22.0/test-phone-number-id/messages'
                && $request['messaging_product'] === 'whatsapp';
        });

        expect(OtpCode::query()->count())->toBe(1);

        $verification = $service->verify('+6281234567890', $code);
        $proof = DB::transaction(fn () => $service->consumeRegistrationProof(
            '+6281234567890',
            $verification['verification_token'],
        ));

        expect($proof->phone)->toBe('+6281234567890');

        expect(fn () => DB::transaction(fn () => $service->consumeRegistrationProof(
            '+6281234567890',
            $verification['verification_token'],
        )))->toThrow(BusinessRuleViolation::class);
    }

    public function test_enforces_cooldown_and_maximum_attempts(): void
    {
        $service = app(OtpService::class);
        $service->send('+6281234567890');

        expect(fn () => $service->send('+6281234567890'))
            ->toThrow(BusinessRuleViolation::class);

        foreach (range(1, 5) as $attempt) {
            expect(fn () => $service->verify('+6281234567890', '000000'))
                ->toThrow(BusinessRuleViolation::class);
        }

        expect(OtpCode::query()->first()->attempt_count)->toBe(5)
            ->and(OtpCode::query()->first()->used_at)->not->toBeNull();

        Http::assertSentCount(1);
    }

    public function test_rejects_otp_after_expiry(): void
    {
        $service = app(OtpService::class);
        $service->send('+6281234567890');
        OtpCode::query()->first()->update(['expires_at' => now()->subSecond()]);

        expect(fn () => $service->verify('+6281234567890', '123456'))
            ->toThrow(BusinessRuleViolation::class);
    }
}
