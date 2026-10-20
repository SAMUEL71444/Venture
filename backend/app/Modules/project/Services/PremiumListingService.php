<?php

namespace App\Modules\project\Services;

use App\Models\Payment;
use App\Models\PremiumListing;
use App\Models\Project;
use App\Models\User;
use App\Modules\ledger\Services\LedgerService;
use App\Modules\notification\Services\NotificationService;
use App\Modules\payment\Gateway\GatewayEvent;
use App\Modules\payment\Gateway\PaymentGateway;
use App\Modules\payment\Jobs\ExpirePaymentJob;
use App\Modules\payment\Services\RefundService;
use App\Modules\payment\State\PaymentStateMachine;
use App\Modules\project\State\PremiumListingStateMachine;
use App\Modules\scheduler\Services\SchedulerPlanner;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use App\Shared\Settings\PlatformSettingsService;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Access\AuthorizationException;
use Throwable;

/**
 * Premium listing Rp 50.000 / 30 hari (README aturan 15). Harga & durasi di-snapshot saat dibeli.
 * Urutan lock: premium_listing -> payment -> wallet.
 */
final class PremiumListingService
{
    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly PaymentGateway $gateway,
        private readonly PaymentStateMachine $payments,
        private readonly PremiumListingStateMachine $listings,
        private readonly LedgerService $ledger,
        private readonly RefundService $refunds,
        private readonly SchedulerPlanner $scheduler,
        private readonly NotificationService $notifications,
        private readonly PlatformSettingsService $settings,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * POST /projects/{id}/premium. Jika masih ada pembelian PENDING_PAYMENT, tagihan itu dikembalikan.
     * Membeli saat masih ACTIVE = perpanjangan (berlaku setelah periode berjalan berakhir).
     *
     * @return array{listing: PremiumListing, payment: Payment, created: bool}
     */
    public function purchase(Project $project, User $umkm, string $method, ?string $ip = null): array
    {
        if ($project->umkm_id !== $umkm->id) {
            throw new AuthorizationException('Only the project owner can buy a premium listing.');
        }

        $result = $this->transactions->run(function () use ($project, $umkm, $method) {
            $project = Project::query()->lockForUpdate()->findOrFail($project->id);
            if ($project->status !== 'OPEN') {
                throw new InvalidStateTransition('Premium listing is only available for OPEN projects.', ['status' => $project->status]);
            }

            $pending = PremiumListing::query()->where('project_id', $project->id)->where('status', 'PENDING_PAYMENT')->lockForUpdate()->first();
            if ($pending && ($payment = Payment::query()->find($pending->payment_id)) && $payment->status === 'PENDING' && $payment->expires_at->isFuture()) {
                return ['listing' => $pending, 'payment' => $payment, 'created' => false];
            }

            $price = $this->settings->int('premium_listing_price');
            $listing = PremiumListing::query()->create([
                'project_id' => $project->id,
                'price' => $price,
                'duration_days' => $this->settings->int('premium_listing_days'),
                'status' => 'PENDING_PAYMENT',
            ]);

            $payment = Payment::query()->create([
                'payer_id' => $umkm->id,
                'purpose' => 'PREMIUM_LISTING',
                'reference_type' => 'PREMIUM_LISTING',
                'reference_id' => $listing->id,
                'amount' => $price,
                'gateway_fee' => $this->gateway->quoteFee($price, $method),
                'gateway' => $this->gateway->name(),
                'method' => $method,
                'status' => 'PENDING',
                'expires_at' => now()->addHours($this->settings->int('payment_expiry_hours')),
            ]);

            $listing->payment_id = $payment->id;
            $listing->save();

            return ['listing' => $listing, 'payment' => $payment, 'created' => true];
        });

        if (! $result['created']) {
            return $result;
        }

        $payment = $result['payment'];
        try {
            $charge = $this->gateway->createCharge($payment);
        } catch (Throwable $exception) {
            $this->transactions->run(fn () => $this->closeUnpaid($result['listing']->id, 'FAILED'));

            throw $exception;
        }

        $payment->forceFill(['gateway_ref' => $charge->gatewayRef, 'checkout_url' => $charge->checkoutUrl])->save();
        ExpirePaymentJob::dispatch($payment->id)->delay($payment->expires_at);
        $this->audit->log($umkm, 'PREMIUM_LISTING_PURCHASED', $result['listing'], null, ['payment_id' => $payment->id, 'price' => $payment->amount], $ip);

        return ['listing' => $result['listing']->fresh(), 'payment' => $payment->fresh(), 'created' => true];
    }

    /** Dipanggil PaymentService untuk webhook payment PREMIUM_LISTING, di dalam transaksi. */
    public function handlePaymentEvent(Payment $payment, GatewayEvent $event): string
    {
        $listing = PremiumListing::query()->lockForUpdate()->findOrFail($payment->reference_id);
        $payment = Payment::query()->lockForUpdate()->findOrFail($payment->id);

        $latePayment = $event->status === GatewayEvent::PAID && in_array($payment->status, ['EXPIRED', 'FAILED'], true);
        if ($payment->status !== 'PENDING' && ! $latePayment) {
            return $payment->status;
        }

        if ($event->status === GatewayEvent::PAID) {
            if ($event->grossAmount !== $payment->total_charged) {
                throw new BusinessRuleViolation('Paid amount does not match the payment.', ['gross_amount' => $event->grossAmount, 'expected' => $payment->total_charged]);
            }

            $this->payments->transition($payment, 'PAID');
            $payment->paid_at = now();
            $payment->save();

            if ($listing->status !== 'PENDING_PAYMENT') {
                // Dibayar setelah listing kedaluwarsa: dikembalikan (biaya gateway tidak).
                $this->refunds->request($payment, $payment->amount, null, fromPayable: false);

                return $payment->status;
            }

            $this->activate($listing, $payment);

            return $payment->status;
        }

        if (in_array($event->status, [GatewayEvent::FAILED, GatewayEvent::EXPIRED], true)) {
            $this->payments->transition($payment, $event->status);
            $payment->save();
            $this->closeListing($listing);
        }

        return $payment->status;
    }

    /** Job expire-payment untuk tagihan premium. */
    public function expirePayment(string $paymentId): void
    {
        $listingId = Payment::query()->whereKey($paymentId)->value('reference_id');
        if (! $listingId) {
            return;
        }

        $this->transactions->run(function () use ($listingId, $paymentId) {
            $listing = PremiumListing::query()->lockForUpdate()->find($listingId);
            $payment = Payment::query()->lockForUpdate()->find($paymentId);
            if (! $listing || ! $payment || $payment->status !== 'PENDING' || $payment->expires_at->isFuture()) {
                return;
            }

            $this->payments->transition($payment, 'EXPIRED');
            $payment->save();
            $this->closeListing($listing);
        });
    }

    private function activate(PremiumListing $listing, Payment $payment): void
    {
        // Perpanjangan: mulai setelah periode ACTIVE terakhir berakhir.
        $latestEnd = PremiumListing::query()->where('project_id', $listing->project_id)->where('status', 'ACTIVE')
            ->where('ends_at', '>', now())->max('ends_at');
        $startsAt = $latestEnd ? CarbonImmutable::parse($latestEnd) : CarbonImmutable::now();

        $this->listings->transition($listing, 'ACTIVE');
        $listing->starts_at = $startsAt;
        $listing->ends_at = $startsAt->addDays($listing->duration_days);
        $listing->save();

        $this->ledger->recordPremiumListing($payment, $listing->id);
        $this->scheduler->premiumListingActivated($listing);

        $project = Project::query()->find($listing->project_id);
        $this->notifications->notify(User::query()->find($payment->payer_id), 'PREMIUM_ACTIVE', 'Premium listing aktif',
            "Project \"{$project?->title}\" tampil di urutan teratas sampai ".$listing->ends_at->timezone(config('app.business_timezone'))->format('d-m-Y').'.',
            ['project_id' => $listing->project_id, 'premium_listing_id' => $listing->id], [NotificationService::WHATSAPP]);
    }

    private function closeUnpaid(string $listingId, string $paymentStatus): void
    {
        $listing = PremiumListing::query()->lockForUpdate()->findOrFail($listingId);
        $payment = Payment::query()->lockForUpdate()->find($listing->payment_id);
        if ($payment?->status === 'PENDING') {
            $this->payments->transition($payment, $paymentStatus);
            $payment->save();
        }
        $this->closeListing($listing);
    }

    private function closeListing(PremiumListing $listing): void
    {
        if ($listing->status === 'PENDING_PAYMENT') {
            $this->listings->transition($listing, 'EXPIRED');
            $listing->save();
        }
    }
}
