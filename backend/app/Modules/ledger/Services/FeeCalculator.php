<?php

namespace App\Modules\ledger\Services;

use InvalidArgumentException;

/**
 * Rumus pencairan per milestone (06-alur-keuangan-escrow.md bagian 4), murni integer Rupiah.
 * Persentase dikonversi ke basis poin (12.00% = 1200 bp) agar tidak ada float di perhitungan uang.
 */
final class FeeCalculator
{
    /** "12.00" / 12 / 12.5 -> 1200 / 1200 / 1250. Maksimal 2 desimal sesuai kolom decimal(5,2). */
    public static function basisPoints(string|int|float $percent): int
    {
        $normalized = is_string($percent) ? trim($percent) : number_format((float) $percent, 2, '.', '');

        if (! preg_match('/^(\d{1,3})(?:\.(\d{1,2}))?$/', $normalized, $match)) {
            throw new InvalidArgumentException("Invalid percentage [{$percent}].");
        }

        return ((int) $match[1]) * 100 + (int) str_pad($match[2] ?? '0', 2, '0');
    }

    /** round(amount * bp / 10000), pembulatan half-up untuk nilai non-negatif. */
    public static function percentOf(int $amount, int $basisPoints): int
    {
        if ($amount < 0 || $basisPoints < 0) {
            throw new InvalidArgumentException('Amount and basis points must be non-negative.');
        }

        return intdiv($amount * $basisPoints + 5000, 10000);
    }

    /**
     * mentor_fee = min(max(mentor_min_fee, round(platform_fee * mentor_share_pct / 100)), platform_fee)
     */
    public static function mentorFee(int $platformFee, int $mentorShareBp, int $mentorMinFee): int
    {
        return min(max($mentorMinFee, self::percentOf($platformFee, $mentorShareBp)), $platformFee);
    }

    /**
     * Pembagian dana milestone yang disetujui. Setiap mentor yang fee_eligible mendapat fee penuh;
     * jika lebih dari satu (mentor diganti), selisihnya ditanggung platform (platform_net bisa negatif).
     *
     * @return array{platform_fee: int, mentor_fees: list<int>, mentor_fee_total: int, platform_net: int, student_amount: int}
     */
    public static function milestoneSplit(int $amount, int $platformFeeBp, int $mentorShareBp, int $mentorMinFee, int $eligibleMentors): array
    {
        $platformFee = self::percentOf($amount, $platformFeeBp);
        $mentorFees = array_fill(0, max(0, $eligibleMentors), self::mentorFee($platformFee, $mentorShareBp, $mentorMinFee));
        $mentorTotal = array_sum($mentorFees);

        return [
            'platform_fee' => $platformFee,
            'mentor_fees' => $mentorFees,
            'mentor_fee_total' => $mentorTotal,
            'platform_net' => $platformFee - $mentorTotal,
            'student_amount' => $amount - $platformFee,
        ];
    }
}
