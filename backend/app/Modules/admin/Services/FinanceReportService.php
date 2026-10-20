<?php

namespace App\Modules\admin\Services;

use App\Models\Escrow;
use App\Models\MilestoneSettlement;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\Refund;
use App\Models\Wallet;
use Carbon\CarbonImmutable;

/** GET /admin/reports/finance — rekap GMV, komisi, refund, saldo escrow & wallet (integer Rupiah). */
final class FinanceReportService
{
    public function summary(?CarbonImmutable $from, ?CarbonImmutable $to): array
    {
        $payments = Payment::query()->where('purpose', 'ESCROW_FUNDING')->whereIn('status', ['PAID', 'REFUNDED']);
        $settlements = MilestoneSettlement::query();
        $refunds = Refund::query()->where('status', 'SUCCESS');
        $premium = Payment::query()->where('purpose', 'PREMIUM_LISTING')->whereIn('status', ['PAID', 'REFUNDED']);
        $payouts = Payout::query();

        foreach ([[$payments, 'paid_at'], [$settlements, 'settled_at'], [$refunds, 'updated_at'], [$premium, 'paid_at'], [$payouts, 'completed_at']] as [$query, $column]) {
            $query->when($from, fn ($q) => $q->where($column, '>=', $from))->when($to, fn ($q) => $q->where($column, '<', $to));
        }

        $walletTotals = Wallet::query()->selectRaw('type, SUM(balance) AS total')->groupBy('type')->pluck('total', 'type');

        return [
            'period' => ['from' => $from?->toIso8601String(), 'to' => $to?->toIso8601String()],
            'gmv' => (int) (clone $payments)->sum('amount'),
            'gateway_fees_paid_by_umkm' => (int) (clone $payments)->sum('gateway_fee'),
            'settled_amount' => (int) (clone $settlements)->sum('gross_amount'),
            'platform_fee' => (int) (clone $settlements)->sum('platform_fee'),
            'mentor_fee' => (int) (clone $settlements)->sum('mentor_fee'),
            'platform_net' => (int) (clone $settlements)->sum('platform_net'),
            'student_earnings' => (int) (clone $settlements)->sum('student_amount'),
            'refunded_to_umkm' => (int) (clone $refunds)->sum('amount'),
            // Posisi saat ini (tidak terpengaruh filter periode).
            'escrow_held' => (int) Escrow::query()->sum('held_amount'),
            'wallet_balances' => [
                'STUDENT' => (int) ($walletTotals['STUDENT'] ?? 0),
                'MENTOR' => (int) ($walletTotals['MENTOR'] ?? 0),
                'PLATFORM_REVENUE' => (int) ($walletTotals['PLATFORM_REVENUE'] ?? 0),
                'UMKM_REFUND' => (int) ($walletTotals['UMKM_REFUND'] ?? 0),
            ],
            'premium_listing_revenue' => (int) (clone $premium)->sum('amount'),
            'payouts' => [
                'success_amount' => (int) (clone $payouts)->where('status', 'SUCCESS')->sum('amount'),
                'success_net_amount' => (int) (clone $payouts)->where('status', 'SUCCESS')->sum('net_amount'),
                'transfer_fees' => (int) (clone $payouts)->where('status', 'SUCCESS')->sum('fee'),
                // Posisi saat ini: saldo yang sedang dikunci untuk penarikan.
                'in_progress_amount' => (int) Payout::query()->whereIn('status', ['REQUESTED', 'PROCESSING'])->sum('amount'),
            ],
        ];
    }
}
