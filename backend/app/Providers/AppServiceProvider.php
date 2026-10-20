<?php

namespace App\Providers;

use App\Modules\notification\Channels\LogNotificationSender;
use App\Modules\notification\Channels\NotificationChannelSender;
use App\Modules\payment\Gateway\MockPaymentGateway;
use App\Modules\payment\Gateway\PaymentGateway;
use App\Modules\payout\Gateway\DisbursementGateway;
use App\Modules\payout\Gateway\MockDisbursementGateway;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, function () {
            $config = config('services.payment_gateway');

            return match ($config['driver'] ?? null) {
                'mock' => $this->guardMock(fn () => new MockPaymentGateway($config['webhook_secret'] ?? null, $config['mock_fees'] ?? [])),
                default => throw new RuntimeException("Unsupported payment gateway driver [{$config['driver']}]."),
            };
        });

        $this->app->singleton(DisbursementGateway::class, function () {
            $config = config('services.disbursement');

            return match ($config['driver'] ?? null) {
                'mock' => $this->guardMock(fn () => new MockDisbursementGateway($config['webhook_secret'] ?? null, $config['mock_fees'] ?? [])),
                default => throw new RuntimeException("Unsupported disbursement driver [{$config['driver']}]."),
            };
        });

        // Kanal WhatsApp/email masih mock (log) sampai template & kredensial disiapkan.
        $this->app->singleton(NotificationChannelSender::class, LogNotificationSender::class);
    }

    /**
     * Driver mock tidak boleh dipakai di production: escrow bisa "terdanai" atau payout
     * "terkirim" tanpa uang sungguhan (audit A1). Fail closed saat driver di-resolve.
     */
    private function guardMock(\Closure $factory): object
    {
        if ($this->app->isProduction()) {
            throw new RuntimeException('Mock payment/disbursement drivers are not allowed in production.');
        }

        return $factory();
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('otp-send', fn (Request $request) => [
            Limit::perMinute(1)->by('otp-send:'.(string) $request->input('phone').':'.$request->ip()),
            // Batas per IP: mencegah satu IP mengirim OTP WhatsApp berbayar ke banyak nomor (audit F6).
            Limit::perHour(10)->by('otp-send-ip:'.$request->ip()),
        ]);
        // Registrasi & kirim ulang email kampus (audit F5).
        RateLimiter::for('register', fn (Request $request) => [
            Limit::perMinute(5)->by('register:'.$request->ip()),
            Limit::perHour(30)->by('register-hour:'.$request->ip()),
        ]);
        RateLimiter::for('campus-email', fn (Request $request) => [
            Limit::perMinute(1)->by('campus-email:'.($request->user()?->id ?? $request->ip())),
            Limit::perHour(5)->by('campus-email-hour:'.($request->user()?->id ?? $request->ip())),
        ]);

        RateLimiter::for('otp-verify', fn (Request $request) => Limit::perMinute(10)
            ->by('otp-verify:'.(string) $request->input('phone').':'.$request->ip()));

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by('login:'.strtolower((string) $request->input('identifier')).':'.$request->ip()));

        RateLimiter::for('refresh', fn (Request $request) => Limit::perMinute(10)
            ->by('refresh:'.$request->ip()));
    }
}
