<?php

namespace App\Modules\ledger\Services;

use App\Models\Contract;
use App\Models\Escrow;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\MentorAssignment;
use App\Models\Milestone;
use App\Models\MilestoneSettlement;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\Wallet;
use App\Modules\ledger\State\EscrowStateMachine;
use App\Shared\Exceptions\BusinessRuleViolation;
use App\Shared\Exceptions\InvalidStateTransition;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Satu-satunya modul yang boleh mengubah saldo escrow & wallet (01-arsitektur-sistem.md).
 * Setiap pergerakan dicatat sebagai ledger_transaction double-entry yang wajib seimbang.
 *
 * Semua method publik HARUS dipanggil di dalam transaksi DB milik pemanggil yang sudah
 * mengunci kontrak; method ini mengunci escrow & wallet sendiri (urutan: escrow -> wallet).
 */
final class LedgerService
{
    public const ACCOUNT_ESCROW = 'ESCROW';

    public const ACCOUNT_WALLET = 'WALLET';

    public const ACCOUNT_GATEWAY_CLEARING = 'GATEWAY_CLEARING';

    public const ACCOUNT_PAYOUT_CLEARING = 'PAYOUT_CLEARING';

    public const ACCOUNT_TRANSFER_FEE_PAYABLE = 'TRANSFER_FEE_PAYABLE';

    private const ACCOUNTS = [
        self::ACCOUNT_ESCROW, self::ACCOUNT_WALLET, self::ACCOUNT_GATEWAY_CLEARING,
        self::ACCOUNT_PAYOUT_CLEARING, self::ACCOUNT_TRANSFER_FEE_PAYABLE,
    ];

    /** Wallet sistem boleh negatif (platform menanggung fee mentor). Wallet user (termasuk UMKM_REFUND) tidak. */
    private const SYSTEM_WALLET_TYPES = ['PLATFORM_REVENUE'];

    public function __construct(private readonly EscrowStateMachine $escrows) {}

    /** Jurnal ESCROW_FUNDED: Gateway Clearing (D) / Escrow Kontrak (K). Biaya gateway tidak masuk escrow. */
    public function fundEscrow(Escrow $escrow, Payment $payment): LedgerTransaction
    {
        $this->assertInTransaction();

        $escrow = Escrow::query()->lockForUpdate()->findOrFail($escrow->id);
        $totalAmount = (int) Contract::query()->whereKey($escrow->contract_id)->value('total_amount');

        if ($payment->amount !== $totalAmount) {
            throw new BusinessRuleViolation('Payment amount does not match the contract value.', [
                'payment_amount' => $payment->amount,
                'contract_total' => $totalAmount,
            ]);
        }

        $this->escrows->transition($escrow, 'HELD');

        $transaction = $this->post('ESCROW_FUNDED', 'CONTRACT', $escrow->contract_id, "payment:{$payment->id}:escrow-funded",
            'Dana UMKM masuk escrow kontrak', [
                $this->entry(self::ACCOUNT_GATEWAY_CLEARING, 'DEBIT', $payment->amount),
                $this->entry(self::ACCOUNT_ESCROW, 'CREDIT', $payment->amount, escrowId: $escrow->id),
            ]);

        $escrow->payment_id = $payment->id;
        $escrow->funded_amount += $payment->amount;
        $escrow->held_amount += $payment->amount;
        $this->assertEscrowInvariant($escrow);
        $escrow->save();

        return $transaction;
    }

    /**
     * Jurnal MILESTONE_RELEASE (06 bagian 3b & 4): Escrow (D) / Wallet Mahasiswa, Wallet Mentor,
     * Pendapatan Platform (K). Membuat milestone_settlement dan mengisi fee mentor_assignments.
     */
    public function releaseMilestone(Contract $contract, Milestone $milestone): MilestoneSettlement
    {
        $this->assertInTransaction();

        $escrow = Escrow::query()->where('contract_id', $contract->id)->lockForUpdate()->first();
        if (! $escrow || ! in_array($escrow->status, ['HELD', 'PARTIALLY_RELEASED'], true)) {
            throw new BusinessRuleViolation('Contract escrow is not funded.', ['escrow_status' => $escrow?->status]);
        }

        if (MilestoneSettlement::query()->where('milestone_id', $milestone->id)->exists()) {
            throw new InvalidStateTransition('Milestone has already been settled.');
        }

        $amount = (int) $milestone->amount;
        if ($escrow->held_amount < $amount) {
            throw new BusinessRuleViolation('Escrow balance is insufficient for this milestone.', [
                'held_amount' => $escrow->held_amount,
                'milestone_amount' => $amount,
            ]);
        }

        if ($contract->platform_fee_pct === null || $contract->mentor_share_pct === null || $contract->mentor_min_fee === null) {
            throw new BusinessRuleViolation('Contract has no fee snapshot.');
        }

        $assignments = MentorAssignment::query()
            ->where('milestone_id', $milestone->id)
            ->where('fee_eligible', true)
            ->whereNull('fee_paid_at')
            ->orderBy('assigned_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $split = FeeCalculator::milestoneSplit(
            $amount,
            FeeCalculator::basisPoints($contract->platform_fee_pct),
            FeeCalculator::basisPoints($contract->mentor_share_pct),
            (int) $contract->mentor_min_fee,
            $assignments->count(),
        );

        $entries = [
            $this->entry(self::ACCOUNT_ESCROW, 'DEBIT', $amount, escrowId: $escrow->id),
            $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $split['student_amount'], walletId: $this->walletFor($contract->student_id, 'STUDENT')->id),
        ];

        foreach ($assignments as $index => $assignment) {
            $entries[] = $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $split['mentor_fees'][$index],
                walletId: $this->walletFor($assignment->mentor_id, 'MENTOR')->id);
        }

        if ($split['platform_net'] !== 0) {
            $platformWalletId = $this->walletFor(null, 'PLATFORM_REVENUE')->id;
            $entries[] = $split['platform_net'] > 0
                ? $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $split['platform_net'], walletId: $platformWalletId)
                // Platform menanggung fee mentor yang melebihi komisi.
                : $this->entry(self::ACCOUNT_WALLET, 'DEBIT', -$split['platform_net'], walletId: $platformWalletId);
        }

        $transaction = $this->post('MILESTONE_RELEASE', 'MILESTONE', $milestone->id, "milestone:{$milestone->id}:release",
            "Pencairan milestone {$milestone->sequence} kontrak {$contract->contract_no}", $entries);

        $now = now();
        foreach ($assignments as $index => $assignment) {
            $assignment->fee_amount = $split['mentor_fees'][$index];
            $assignment->fee_paid_at = $now;
            $assignment->save();
        }

        $settlement = MilestoneSettlement::query()->create([
            'milestone_id' => $milestone->id,
            'gross_amount' => $amount,
            'platform_fee' => $split['platform_fee'],
            'mentor_fee' => $split['mentor_fee_total'],
            'platform_net' => $split['platform_net'],
            'student_amount' => $split['student_amount'],
            'refund_amount' => 0,
            'ledger_transaction_id' => $transaction->id,
            'settled_at' => $now,
        ]);

        $escrow->released_amount += $amount;
        $escrow->held_amount -= $amount;
        $this->escrows->transition($escrow, $escrow->held_amount === 0 ? 'RELEASED' : 'PARTIALLY_RELEASED');
        $this->assertEscrowInvariant($escrow);
        $escrow->save();

        return $settlement;
    }

    /**
     * Batal di status FUNDED: nilai project dikembalikan penuh ke UMKM (biaya gateway tidak).
     * Jurnal REFUND: Escrow (D) / UMKM Refund Payable (K). Escrow HELD -> REFUNDED.
     */
    public function refundEscrowInFull(Contract $contract): int
    {
        $this->assertInTransaction();

        $escrow = Escrow::query()->where('contract_id', $contract->id)->lockForUpdate()->first();
        if (! $escrow || $escrow->status !== 'HELD') {
            throw new BusinessRuleViolation('Only fully held escrow can be refunded in full.', ['escrow_status' => $escrow?->status]);
        }

        $amount = $escrow->held_amount;
        $this->escrows->transition($escrow, 'REFUNDED');

        $this->post('REFUND', 'CONTRACT', $contract->id, "contract:{$contract->id}:refund", 'Pembatalan sebelum mulai: nilai project dikembalikan', [
            $this->entry(self::ACCOUNT_ESCROW, 'DEBIT', $amount, escrowId: $escrow->id),
            $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $amount, walletId: $this->walletFor($contract->umkm_id, 'UMKM_REFUND')->id),
        ]);

        $escrow->refunded_amount += $amount;
        $escrow->held_amount = 0;
        $this->assertEscrowInvariant($escrow);
        $escrow->save();

        return $amount;
    }

    /**
     * Keputusan admin atas pembatalan/terminasi (06 bagian 3c & 4). Per milestone yang dananya
     * masih ditahan: bagian mahasiswa dipotong komisi (MILESTONE_RELEASE), bagian UMKM di-refund
     * (REFUND), fee mentor fee_eligible dihitung dari nilai PENUH milestone dan ditanggung platform.
     *
     * @param  array<string, array{amount_to_student: int, amount_to_umkm: int}>  $allocations  per milestone_id
     * @return array{to_student: int, to_umkm: int, mentor_fees: array<string, int>}
     */
    public function settleTermination(Contract $contract, array $allocations): array
    {
        $this->assertInTransaction();

        $escrow = Escrow::query()->where('contract_id', $contract->id)->lockForUpdate()->first();
        if (! $escrow || ! in_array($escrow->status, ['HELD', 'PARTIALLY_RELEASED'], true)) {
            throw new BusinessRuleViolation('Contract escrow is not funded.', ['escrow_status' => $escrow?->status]);
        }

        $milestones = Milestone::query()->whereIn('id', array_keys($allocations))->orderBy('sequence')->get();
        $total = array_sum(array_map(fn (array $a) => $a['amount_to_student'] + $a['amount_to_umkm'], $allocations));
        if ($total !== $escrow->held_amount) {
            throw new BusinessRuleViolation('Allocations must equal the amount held in escrow.', [
                'allocated' => $total,
                'held_amount' => $escrow->held_amount,
            ]);
        }

        $feeBp = FeeCalculator::basisPoints($contract->platform_fee_pct);
        $shareBp = FeeCalculator::basisPoints($contract->mentor_share_pct);
        $platformWalletId = $this->walletFor(null, 'PLATFORM_REVENUE')->id;
        $now = now();
        $result = ['to_student' => 0, 'to_umkm' => 0, 'mentor_fees' => []];

        foreach ($milestones as $milestone) {
            if (MilestoneSettlement::query()->where('milestone_id', $milestone->id)->exists()) {
                throw new InvalidStateTransition('Milestone has already been settled.', ['milestone_id' => $milestone->id]);
            }

            $toStudent = $allocations[$milestone->id]['amount_to_student'];
            $toUmkm = $allocations[$milestone->id]['amount_to_umkm'];

            $assignments = MentorAssignment::query()->where('milestone_id', $milestone->id)
                ->where('fee_eligible', true)->whereNull('fee_paid_at')
                ->orderBy('assigned_at')->orderBy('id')->lockForUpdate()->get();
            // Fee mentor dari nilai penuh milestone, bukan dari bagian mahasiswa.
            $mentorFee = FeeCalculator::mentorFee(
                FeeCalculator::percentOf((int) $milestone->amount, $feeBp), $shareBp, (int) $contract->mentor_min_fee
            );
            $mentorTotal = $mentorFee * $assignments->count();
            $platformFee = FeeCalculator::percentOf($toStudent, $feeBp);
            $platformNet = $platformFee - $mentorTotal;

            $mentorEntries = [];
            foreach ($assignments as $assignment) {
                $mentorEntries[] = $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $mentorFee, walletId: $this->walletFor($assignment->mentor_id, 'MENTOR')->id);
            }
            $platformEntry = $platformNet >= 0
                ? $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $platformNet, walletId: $platformWalletId)
                : $this->entry(self::ACCOUNT_WALLET, 'DEBIT', -$platformNet, walletId: $platformWalletId);

            $firstTransaction = null;
            if ($toStudent > 0) {
                $firstTransaction = $this->post('MILESTONE_RELEASE', 'MILESTONE', $milestone->id, "milestone:{$milestone->id}:termination-release",
                    "Alokasi pembatalan ke mahasiswa, milestone {$milestone->sequence}", [
                        $this->entry(self::ACCOUNT_ESCROW, 'DEBIT', $toStudent, escrowId: $escrow->id),
                        $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $toStudent - $platformFee, walletId: $this->walletFor($contract->student_id, 'STUDENT')->id),
                        $platformEntry,
                        ...$mentorEntries,
                    ]);
            }

            if ($toUmkm > 0) {
                $refundEntries = [
                    $this->entry(self::ACCOUNT_ESCROW, 'DEBIT', $toUmkm, escrowId: $escrow->id),
                    $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $toUmkm, walletId: $this->walletFor($contract->umkm_id, 'UMKM_REFUND')->id),
                ];
                if (! $firstTransaction) {
                    // Seluruh milestone di-refund: fee mentor ditanggung platform (06 bagian 3c).
                    $refundEntries = [...$refundEntries, $platformEntry, ...$mentorEntries];
                }

                $refundTransaction = $this->post('REFUND', 'MILESTONE', $milestone->id, "milestone:{$milestone->id}:termination-refund",
                    "Alokasi pembatalan ke UMKM, milestone {$milestone->sequence}", $refundEntries);
                $firstTransaction ??= $refundTransaction;
            }

            if (! $firstTransaction) {
                throw new BusinessRuleViolation('Milestone allocation cannot be empty.', ['milestone_id' => $milestone->id]);
            }

            foreach ($assignments as $assignment) {
                $assignment->fee_amount = $mentorFee;
                $assignment->fee_paid_at = $now;
                $assignment->save();
                $result['mentor_fees'][$assignment->mentor_id] = ($result['mentor_fees'][$assignment->mentor_id] ?? 0) + $mentorFee;
            }

            MilestoneSettlement::query()->create([
                'milestone_id' => $milestone->id,
                'gross_amount' => $toStudent + $toUmkm,
                'platform_fee' => $platformFee,
                'mentor_fee' => $mentorTotal,
                'platform_net' => $platformNet,
                'student_amount' => $toStudent - $platformFee,
                'refund_amount' => $toUmkm,
                'ledger_transaction_id' => $firstTransaction->id,
                'settled_at' => $now,
            ]);

            $escrow->released_amount += $toStudent;
            $escrow->refunded_amount += $toUmkm;
            $escrow->held_amount -= $toStudent + $toUmkm;
            $result['to_student'] += $toStudent;
            $result['to_umkm'] += $toUmkm;
        }

        $this->escrows->transition($escrow, 'SETTLED');
        $this->assertEscrowInvariant($escrow);
        $escrow->save();

        return $result;
    }

    /** Refund sukses dikirim gateway: UMKM Refund Payable (D) / Gateway Clearing (K). */
    public function recordRefundPaid(string $refundId, string $umkmUserId, int $amount): void
    {
        $this->assertInTransaction();

        $this->post('REFUND', 'REFUND', $refundId, "refund:{$refundId}:paid", 'Refund dikirim ke UMKM lewat gateway', [
            $this->entry(self::ACCOUNT_WALLET, 'DEBIT', $amount, walletId: $this->walletFor($umkmUserId, 'UMKM_REFUND')->id),
            $this->entry(self::ACCOUNT_GATEWAY_CLEARING, 'CREDIT', $amount),
        ]);
    }

    /**
     * Jurnal WITHDRAWAL (06 bagian 3d): Wallet (D) amount / Payout Clearing (K) net / Biaya Transfer Payable (K) fee.
     * Saldo langsung berkurang (dikunci) dan dicatat di pending_withdrawal sampai disbursement selesai.
     */
    public function withdraw(Payout $payout): void
    {
        $this->assertInTransaction();

        $this->post('WITHDRAWAL', 'PAYOUT', $payout->id, "payout:{$payout->id}:withdraw", 'Penarikan saldo', [
            $this->entry(self::ACCOUNT_WALLET, 'DEBIT', $payout->amount, walletId: $payout->wallet_id),
            $this->entry(self::ACCOUNT_PAYOUT_CLEARING, 'CREDIT', $payout->net_amount),
            $this->entry(self::ACCOUNT_TRANSFER_FEE_PAYABLE, 'CREDIT', $payout->fee),
        ]);

        Wallet::query()->whereKey($payout->wallet_id)->increment('pending_withdrawal', $payout->amount);
    }

    /** Disbursement gagal: jurnal reversal, saldo kembali ke wallet. */
    public function reverseWithdrawal(Payout $payout): void
    {
        $this->assertInTransaction();

        $this->post('WITHDRAWAL', 'PAYOUT', $payout->id, "payout:{$payout->id}:reversal", 'Penarikan gagal, saldo dikembalikan', [
            $this->entry(self::ACCOUNT_PAYOUT_CLEARING, 'DEBIT', $payout->net_amount),
            $this->entry(self::ACCOUNT_TRANSFER_FEE_PAYABLE, 'DEBIT', $payout->fee),
            $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $payout->amount, walletId: $payout->wallet_id),
        ]);

        Wallet::query()->whereKey($payout->wallet_id)->decrement('pending_withdrawal', $payout->amount);
    }

    /** Disbursement sukses: saldo yang dikunci dilepas dari pending_withdrawal (jurnal sudah dicatat saat request). */
    public function completeWithdrawal(Payout $payout): void
    {
        $this->assertInTransaction();

        Wallet::query()->whereKey($payout->wallet_id)->decrement('pending_withdrawal', $payout->amount);
    }

    /** Jurnal PREMIUM_LISTING: Gateway Clearing (D) / Pendapatan Platform (K). */
    public function recordPremiumListing(Payment $payment, string $listingId): void
    {
        $this->assertInTransaction();

        $this->post('PREMIUM_LISTING', 'PREMIUM_LISTING', $listingId, "payment:{$payment->id}:premium-listing", 'Pembelian premium listing', [
            $this->entry(self::ACCOUNT_GATEWAY_CLEARING, 'DEBIT', $payment->amount),
            $this->entry(self::ACCOUNT_WALLET, 'CREDIT', $payment->amount, walletId: $this->walletFor(null, 'PLATFORM_REVENUE')->id),
        ]);
    }

    /** Wallet per (user, type); wallet sistem memakai user_id NULL. Aman terhadap pembuatan bersamaan. */
    public function walletFor(?string $userId, string $type): Wallet
    {
        $attributes = ['user_id' => $userId, 'type' => $type];

        return Wallet::query()->where($attributes)->first()
            ?? Wallet::query()->createOrFirst($attributes, ['balance' => 0, 'pending_withdrawal' => 0]);
    }

    /**
     * Posting jurnal: validasi akun & nominal, wajib seimbang, idempotency key unik,
     * lalu perbarui cache saldo wallet (lock baris wallet berurutan id agar tidak deadlock).
     *
     * @param  list<array{account_type: string, direction: string, amount: int, escrow_id: ?string, wallet_id: ?string}>  $entries
     */
    private function post(string $type, string $referenceType, string $referenceId, string $idempotencyKey, string $description, array $entries): LedgerTransaction
    {
        $debit = 0;
        $credit = 0;

        // Baris bernilai 0 (misal fee mentor 0 jika setting diubah) tidak dicatat.
        $entries = array_values(array_filter($entries, fn (array $entry) => $entry['amount'] !== 0));

        foreach ($entries as $entry) {
            if (! is_int($entry['amount']) || $entry['amount'] < 0) {
                throw new LogicException('Ledger entry amount must be a positive integer.');
            }
            if (! in_array($entry['account_type'], self::ACCOUNTS, true)) {
                throw new LogicException("Unknown ledger account [{$entry['account_type']}].");
            }
            if (($entry['account_type'] === self::ACCOUNT_WALLET) !== ($entry['wallet_id'] !== null)
                || ($entry['account_type'] === self::ACCOUNT_ESCROW) !== ($entry['escrow_id'] !== null)) {
                throw new LogicException('Ledger entry account reference is inconsistent.');
            }

            match ($entry['direction']) {
                'DEBIT' => $debit += $entry['amount'],
                'CREDIT' => $credit += $entry['amount'],
                default => throw new LogicException("Unknown ledger direction [{$entry['direction']}]."),
            };
        }

        if ($debit !== $credit || $debit === 0) {
            // Exception -> transaksi DB pemanggil di-rollback.
            throw new LogicException("Unbalanced ledger transaction [{$type}]: debit {$debit} != credit {$credit}.");
        }

        if (LedgerTransaction::query()->where('idempotency_key', $idempotencyKey)->exists()) {
            throw new InvalidStateTransition('This ledger transaction has already been posted.', ['idempotency_key' => $idempotencyKey]);
        }

        $transaction = LedgerTransaction::query()->create([
            'type' => $type,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'idempotency_key' => $idempotencyKey,
            'description' => $description,
        ]);

        foreach ($entries as $entry) {
            LedgerEntry::query()->create(['transaction_id' => $transaction->id, ...$entry]);
        }

        $walletDeltas = [];
        foreach ($entries as $entry) {
            if ($entry['wallet_id'] !== null) {
                $walletDeltas[$entry['wallet_id']] = ($walletDeltas[$entry['wallet_id']] ?? 0)
                    + ($entry['direction'] === 'CREDIT' ? $entry['amount'] : -$entry['amount']);
            }
        }
        ksort($walletDeltas);

        foreach ($walletDeltas as $walletId => $delta) {
            $wallet = Wallet::query()->lockForUpdate()->findOrFail($walletId);
            $wallet->balance += $delta;

            if ($wallet->balance < 0 && ! in_array($wallet->type, self::SYSTEM_WALLET_TYPES, true)) {
                throw new BusinessRuleViolation('Insufficient wallet balance.', ['wallet_id' => $walletId]);
            }

            $wallet->save();
        }

        return $transaction;
    }

    private function entry(string $account, string $direction, int $amount, ?string $escrowId = null, ?string $walletId = null): array
    {
        return [
            'account_type' => $account,
            'direction' => $direction,
            'amount' => $amount,
            'escrow_id' => $escrowId,
            'wallet_id' => $walletId,
        ];
    }

    private function assertEscrowInvariant(Escrow $escrow): void
    {
        if ($escrow->held_amount !== $escrow->funded_amount - $escrow->released_amount - $escrow->refunded_amount
            || $escrow->held_amount < 0) {
            throw new LogicException("Escrow invariant violated for escrow [{$escrow->id}].");
        }
    }

    private function assertInTransaction(): void
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('Ledger operations must run inside a database transaction.');
        }
    }
}
