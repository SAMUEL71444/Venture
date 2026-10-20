<?php

namespace App\Modules\payout\Gateway;

use App\Models\BankAccount;
use App\Models\Payout;

/** Kontrak driver disbursement (transfer ke rekening / e-wallet). */
interface DisbursementGateway
{
    public function name(): string;

    /** Biaya transfer untuk kanal BANK / EWALLET (ditanggung penarik). */
    public function quoteFee(string $channel): int;

    /** Validasi rekening (nama pemilik cocok). Dipanggil di luar transaksi DB. */
    public function validateAccount(BankAccount $account): bool;

    /** Kirim disbursement senilai net_amount. Dipanggil di luar transaksi DB. */
    public function disburse(Payout $payout, BankAccount $account): DisbursementResult;

    public function verifyWebhook(string $rawBody, array $headers): bool;

    /** @return array{gateway_ref: string, status: string} status SUCCESS | FAILED */
    public function parseWebhook(string $rawBody): array;
}
