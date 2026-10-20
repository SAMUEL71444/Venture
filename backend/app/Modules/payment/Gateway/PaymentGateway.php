<?php

namespace App\Modules\payment\Gateway;

use App\Models\Payment;

/** Kontrak driver payment gateway (Midtrans / Xendit / mock). */
interface PaymentGateway
{
    /** Nilai kolom payments.gateway. */
    public function name(): string;

    /** Biaya layanan pembayaran yang ditanggung UMKM untuk metode tertentu. */
    public function quoteFee(int $amount, string $method): int;

    /** Buat tagihan di gateway. Dipanggil di luar transaksi DB. */
    public function createCharge(Payment $payment): GatewayCharge;

    /** Minta refund sebagian/penuh atas payment. Dipanggil di luar transaksi DB. */
    public function refund(Payment $payment, int $amount, string $reference): GatewayRefund;

    /** Verifikasi signature webhook terhadap raw body. Harus fail closed jika secret belum dikonfigurasi. */
    public function verifyWebhook(string $rawBody, array $headers): bool;

    /** Terjemahkan payload webhook ke event internal. */
    public function parseWebhook(string $rawBody): GatewayEvent;
}
