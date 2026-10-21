<?php

namespace App\Support\Demo;

use App\Models\AdminAlert;
use App\Models\AlertFollowUp;
use App\Models\AuditLog;
use App\Models\CancellationRequest;
use App\Models\Certificate;
use App\Models\Contract;
use App\Models\Escrow;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\MentorProfile;
use App\Models\Milestone;
use App\Models\MilestoneSettlement;
use App\Models\Payment;
use App\Models\PaymentWebhookLog;
use App\Models\Payout;
use App\Models\Project;
use App\Models\Refund;
use App\Models\StudentProfile;
use App\Models\Submission;
use App\Models\SubmissionFile;
use App\Models\UmkmProfile;
use App\Models\User;
use App\Models\Wallet;
use App\Modules\auth\Http\Controllers\VerificationController;
use App\Modules\review\Services\MilestoneReviewService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Menghapus HANYA data milik akun @demo.digitalin.test beserta seluruh turunannya
 * (proyek, kontrak, milestone, dana escrow & ledger, sengketa/alert, pembatalan,
 * audit log, file KTM & hasil kerja) dalam satu transaksi. Data non-demo tidak disentuh,
 * kecuali saldo wallet non-demo (wallet sistem platform, atau mentor non-demo) yang
 * dikoreksi sebesar entri ledger demo yang dihapus supaya ledger tetap seimbang.
 * Kategori layanan & katalog universitas (data referensi bersama) tidak dihapus.
 */
final class DemoDataCleaner
{
    /** @return array<string, int> jumlah baris terhapus per jenis data */
    public function clear(): array
    {
        $counts = [];
        $files = [];

        DB::transaction(function () use (&$counts, &$files) {
            $users = DemoAccounts::query()->pluck('id');
            if ($users->isEmpty()) {
                return;
            }

            $projects = Project::query()->whereIn('umkm_id', $users)->pluck('id');
            $contracts = Contract::query()
                ->whereIn('umkm_id', $users)->orWhereIn('student_id', $users)->orWhereIn('project_id', $projects)
                ->pluck('id');
            $milestones = Milestone::query()->whereIn('contract_id', $contracts)->pluck('id');
            $submissions = Submission::query()->whereIn('milestone_id', $milestones)->pluck('id');
            $escrows = Escrow::query()->whereIn('contract_id', $contracts)->pluck('id');
            $payments = Payment::query()->whereIn('payer_id', $users)
                ->orWhere(fn ($q) => $q->where('reference_type', 'CONTRACT')->whereIn('reference_id', $contracts))
                ->pluck('id');
            $wallets = Wallet::query()->whereIn('user_id', $users)->pluck('id');
            $cancellations = CancellationRequest::query()->whereIn('contract_id', $contracts)->pluck('id');
            $studentProfiles = StudentProfile::query()->whereIn('user_id', $users)->get(['id', 'ktm_file_url']);
            $profileIds = $studentProfiles->pluck('id')
                ->merge(UmkmProfile::query()->whereIn('user_id', $users)->pluck('id'))
                ->merge(MentorProfile::query()->whereIn('user_id', $users)->pluck('id'));

            $transactions = LedgerEntry::query()->whereIn('escrow_id', $escrows)->orWhereIn('wallet_id', $wallets)->pluck('transaction_id')
                ->merge(LedgerTransaction::query()->whereIn('reference_id', $contracts->merge($milestones)->merge($payments)->merge($escrows)->merge($cancellations))->pluck('id'))
                ->unique()->values();

            $files[] = [VerificationController::ktmDisk(), $studentProfiles->pluck('ktm_file_url')->filter()->values()->all()];
            $files[] = [MilestoneReviewService::fileDisk(), SubmissionFile::query()->whereIn('submission_id', $submissions)->pluck('file_url')->all()];

            // Saldo wallet non-demo yang ikut tersentuh transaksi demo dikoreksi (saldo = kredit − debit).
            LedgerEntry::query()->whereIn('transaction_id', $transactions)->whereNotNull('wallet_id')->whereNotIn('wallet_id', $wallets)->get()
                ->groupBy('wallet_id')
                ->each(function (Collection $entries, string $walletId) {
                    $net = $entries->where('direction', 'CREDIT')->sum('amount') - $entries->where('direction', 'DEBIT')->sum('amount');
                    Wallet::query()->whereKey($walletId)->update(['balance' => DB::raw('balance - ('.(int) $net.')')]);
                });

            $entityIds = $users->merge($projects)->merge($contracts)->merge($milestones)->merge($submissions)
                ->merge($escrows)->merge($payments)->merge($cancellations)->merge($profileIds)->unique()->values();
            $alerts = AdminAlert::query()->whereIn('reference_id', $milestones->merge($contracts)->merge($cancellations))->pluck('id');
            $gatewayRefs = Payment::query()->whereIn('id', $payments)->whereNotNull('gateway_ref')->pluck('gateway_ref');

            // Urutan mengikuti FK restrict: dari turunan paling bawah ke atas.
            $counts['milestone_settlements'] = MilestoneSettlement::query()->whereIn('milestone_id', $milestones)->orWhereIn('ledger_transaction_id', $transactions)->delete();
            $counts['ledger_entries'] = LedgerEntry::query()->whereIn('transaction_id', $transactions)->delete();
            $counts['ledger_transactions'] = LedgerTransaction::query()->whereIn('id', $transactions)->delete();
            $counts['refunds'] = Refund::query()->whereIn('payment_id', $payments)->orWhereIn('cancellation_request_id', $cancellations)->delete();
            $counts['payouts'] = Payout::query()->whereIn('wallet_id', $wallets)->delete();
            $counts['cancellation_requests'] = CancellationRequest::query()->whereIn('id', $cancellations)->delete();
            $counts['alert_follow_ups'] = AlertFollowUp::query()->whereIn('alert_id', $alerts)->orWhereIn('admin_id', $users)->delete();
            $counts['admin_alerts'] = AdminAlert::query()->whereIn('id', $alerts)->delete();
            $counts['certificates'] = Certificate::query()->whereIn('contract_id', $contracts)->orWhereIn('student_id', $users)->delete();
            $counts['audit_logs'] = AuditLog::query()->whereIn('actor_id', $users)->orWhereIn('entity_id', $entityIds)->delete();
            if (Schema::hasTable('scheduler_action_logs')) {
                $counts['scheduler_action_logs'] = DB::table('scheduler_action_logs')->whereIn('entity_id', $entityIds)->delete();
            }
            $counts['payment_webhook_logs'] = PaymentWebhookLog::query()->whereIn('gateway_ref', $gatewayRefs)->delete();
            $counts['milestones'] = Milestone::query()->whereIn('id', $milestones)->delete();
            $counts['escrows'] = Escrow::query()->whereIn('id', $escrows)->delete();
            $counts['contracts'] = Contract::query()->whereIn('id', $contracts)->delete();
            $counts['payments'] = Payment::query()->whereIn('id', $payments)->delete();
            $counts['wallets'] = Wallet::query()->whereIn('id', $wallets)->delete();
            $counts['projects'] = Project::query()->whereIn('id', $projects)->delete();
            PersonalAccessToken::query()->where('tokenable_type', User::class)->whereIn('tokenable_id', $users)->delete();
            // Profil, skill, portofolio, notifikasi, lamaran, pesan, refresh token ikut terhapus (cascade).
            $counts['users'] = User::query()->whereIn('id', $users)->delete();
        });

        // File baru dihapus setelah transaksi berhasil (penghapusan file tidak bisa di-rollback).
        foreach ($files as [$disk, $paths]) {
            if ($paths) {
                Storage::disk($disk)->delete($paths);
            }
        }

        return array_filter($counts);
    }
}
