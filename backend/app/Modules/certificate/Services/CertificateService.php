<?php

namespace App\Modules\certificate\Services;

use App\Models\Certificate;
use App\Models\Contract;
use App\Models\PortfolioItem;
use App\Models\Project;
use App\Models\StudentProfile;
use App\Models\User;
use App\Modules\notification\Services\NotificationService;
use Illuminate\Support\Str;

/**
 * Kontrak COMPLETED: terbitkan sertifikat + portofolio terverifikasi, minta rating
 * (05-sequence-diagram.md bagian 3 akhir). Dipanggil di transaksi yang menyelesaikan kontrak.
 */
final class CertificateService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function issueForCompletedContract(Contract $contract): Certificate
    {
        $existing = Certificate::query()->where('contract_id', $contract->id)->first();
        if ($existing) {
            return $existing;
        }

        $project = Project::query()->with('category:id,name')->findOrFail($contract->project_id);
        $profile = StudentProfile::query()->where('user_id', $contract->student_id)->lockForUpdate()->first();

        $certificate = Certificate::query()->create([
            'contract_id' => $contract->id,
            'student_id' => $contract->student_id,
            'certificate_no' => 'CERT-'.now()->format('Y').'-'.Str::upper(Str::random(8)),
            // Kode acak panjang untuk URL verifikasi publik (tidak bisa ditebak).
            'verification_code' => Str::random(40),
            // PDF belum dibuat: butuh library PDF (lihat PROGRESS.md). Data verifikasi tersedia lewat API.
            'pdf_url' => null,
            'issued_at' => now(),
        ]);

        if ($profile) {
            PortfolioItem::query()->create([
                'student_id' => $profile->id,
                'contract_id' => $contract->id,
                'title' => $project->title,
                'description' => $project->description,
                'media_urls' => [],
                'is_verified' => true,
            ]);

            $profile->completed_contracts_count += 1;
            $profile->save();
        }

        $this->notifications->notify(User::query()->find($contract->student_id), 'CERTIFICATE_ISSUED', 'Kontrak selesai, sertifikat terbit',
            "Selamat! Sertifikat untuk project \"{$project->title}\" sudah terbit.",
            ['contract_id' => $contract->id, 'certificate_id' => $certificate->id], [NotificationService::EMAIL]);
        $this->notifications->notify(User::query()->whereIn('id', [$contract->umkm_id, $contract->student_id])->get(), 'RATING_REQUESTED',
            'Beri penilaian', "Kontrak {$contract->contract_no} selesai. Silakan beri rating.", ['contract_id' => $contract->id]);

        return $certificate;
    }

    /** Data publik untuk HRD (tanpa email / nomor HP). */
    public function publicView(Certificate $certificate): array
    {
        $contract = Contract::query()->with(['project:id,title,category_id', 'project.category:id,name'])->findOrFail($certificate->contract_id);
        $student = User::query()->find($certificate->student_id);
        $profile = StudentProfile::query()->with('university:id,name')->where('user_id', $certificate->student_id)->first();

        return [
            'valid' => true,
            'certificate_no' => $certificate->certificate_no,
            'issued_at' => $certificate->issued_at,
            'student_name' => $student?->name,
            'university' => $profile?->university?->name,
            'project_title' => $contract->project?->title,
            'category' => $contract->project?->category?->name,
            'completed_at' => $contract->completed_at,
            'milestones_count' => $contract->milestones()->count(),
        ];
    }
}
