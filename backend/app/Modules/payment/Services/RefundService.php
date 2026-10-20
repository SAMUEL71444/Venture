<?php

namespace App\Modules\payment\Services;

use App\Models\Payment;
use App\Models\Refund;
use App\Models\User;
use App\Modules\ledger\Services\LedgerService;
use App\Modules\notification\Services\NotificationService;
use App\Modules\payment\Gateway\GatewayRefund;
use App\Modules\payment\Gateway\PaymentGateway;
use App\Modules\payment\Jobs\ProcessRefundJob;
use App\Modules\payment\State\PaymentStateMachine;
use App\Shared\Audit\AuditLogger;
use App\Shared\Database\TransactionRunner;
use Throwable;

/**
 * Refund ke UMKM lewat gateway. Hanya nilai project; biaya gateway tidak dikembalikan (README aturan 18).
 * - fromPayable = true: dana sudah dijurnal ke UMKM Refund Payable (pembatalan/terminasi); saat refund
 *   sukses dicatat jurnal Payable (D) / Gateway Clearing (K).
 * - fromPayable = false: payment masuk setelah kontrak batal sehingga tidak pernah masuk ledger.
 */
final class RefundService
{
    public function __construct(
        private readonly TransactionRunner $transactions,
        private readonly PaymentGateway $gateway,
        private readonly PaymentStateMachine $payments,
        private readonly LedgerService $ledger,
        private readonly NotificationService $notifications,
        private readonly AuditLogger $audit,
    ) {}

    /** Dipanggil di dalam transaksi pemanggil; panggilan gateway dijalankan setelah commit. */
    public function request(Payment $payment, int $amount, ?string $cancellationRequestId, bool $fromPayable): Refund
    {
        $refund = Refund::query()->create([
            'payment_id' => $payment->id,
            'cancellation_request_id' => $cancellationRequestId,
            'amount' => $amount,
            'status' => 'PENDING',
        ]);

        ProcessRefundJob::dispatch($refund->id, $fromPayable)->afterCommit();

        return $refund;
    }

    public function process(string $refundId, bool $fromPayable): void
    {
        $refund = $this->transactions->run(function () use ($refundId) {
            $refund = Refund::query()->lockForUpdate()->find($refundId);
            if (! $refund || $refund->status !== 'PENDING') {
                return null;
            }
            $refund->status = 'PROCESSING';
            $refund->save();

            return $refund;
        });

        if (! $refund) {
            return;
        }

        $payment = Payment::query()->findOrFail($refund->payment_id);

        try {
            $result = $this->gateway->refund($payment, $refund->amount, $refund->id);
        } catch (Throwable $exception) {
            // Gagal dicatat & admin diberi tahu; dana tetap di UMKM Refund Payable untuk dicoba ulang.
            $this->fail($refund, $exception->getMessage());

            return;
        }

        $this->transactions->run(function () use ($refund, $payment, $result, $fromPayable) {
            $refund = Refund::query()->lockForUpdate()->findOrFail($refund->id);
            $refund->gateway_ref = $result->gatewayRef;

            if ($result->status === GatewayRefund::FAILED) {
                $refund->status = 'FAILED';
                $refund->save();
                $this->notifyFailure($refund);

                return;
            }

            if ($result->status === GatewayRefund::PROCESSING) {
                // Driver asli: konfirmasi akhir lewat webhook refund (belum ada di driver mock).
                $refund->save();

                return;
            }

            $refund->status = 'SUCCESS';
            $refund->save();

            if ($fromPayable) {
                $this->ledger->recordRefundPaid($refund->id, $payment->payer_id, $refund->amount);
            }

            $payment = Payment::query()->lockForUpdate()->findOrFail($payment->id);
            $refunded = (int) Refund::query()->where('payment_id', $payment->id)->where('status', 'SUCCESS')->sum('amount');
            if ($payment->status === 'PAID' && $refunded >= $payment->amount) {
                $this->payments->transition($payment, 'REFUNDED');
                $payment->save();
            }

            $this->audit->log(null, 'REFUND_SUCCEEDED', $refund, null, [
                'payment_id' => $payment->id,
                'amount' => $refund->amount,
                'gateway_ref' => $refund->gateway_ref,
            ]);

            $this->notifications->notify(User::query()->find($payment->payer_id), 'REFUND_SENT', 'Dana dikembalikan',
                'Rp '.number_format($refund->amount, 0, ',', '.').' dikembalikan ke metode pembayaran Anda.',
                ['refund_id' => $refund->id], [NotificationService::WHATSAPP]);
        });
    }

    private function fail(Refund $refund, string $reason): void
    {
        $this->transactions->run(function () use ($refund, $reason) {
            $locked = Refund::query()->lockForUpdate()->findOrFail($refund->id);
            $locked->status = 'FAILED';
            $locked->save();
            $this->audit->log(null, 'REFUND_FAILED', $locked, null, ['reason' => $reason]);
            $this->notifyFailure($locked);
        });
    }

    private function notifyFailure(Refund $refund): void
    {
        $this->notifications->notifyAdmins('ADMIN_ALERT', 'Refund gagal', "Refund {$refund->id} gagal diproses gateway dan perlu ditindaklanjuti.",
            ['refund_id' => $refund->id], [NotificationService::IN_APP]);
    }
}
