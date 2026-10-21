<?php

namespace App\Modules\profile\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Profil publik mahasiswa (GET /students, GET /students/{id}). Whitelist eksplisit:
 * nama tampilan, foto, universitas (katalog ATAU nama custom), kota, skill,
 * ringkasan portofolio, rating, status terverifikasi. TIDAK mengirim email, nomor HP,
 * email kampus, KTM, alasan penolakan, catatan admin, atau kolom internal.
 */
final class PublicStudentProfileResource extends JsonResource
{
    private const PORTFOLIO_LIMIT = 6;

    public function toArray(Request $request): array
    {
        $university = $this->university;
        $portfolio = $this->portfolioItems;

        return [
            'id' => $this->id,
            'name' => $this->user?->name,
            // Belum ada kolom foto profil di skema; disiapkan agar kontrak respons stabil.
            'photo_url' => null,
            'university' => $university ? ['id' => $university->id, 'name' => $university->name] : null,
            'university_name_custom' => $this->university_name_custom,
            'city' => $university?->city,
            'skills' => $this->skills->map(fn ($skill) => [
                'id' => $skill->id,
                'name' => $skill->name,
                'level' => $skill->pivot?->level,
            ])->values(),
            'portfolio_count' => $portfolio->count(),
            'portfolio' => $portfolio->take(self::PORTFOLIO_LIMIT)->map(fn ($item) => [
                'id' => $item->id,
                'title' => $item->title,
                'summary' => $item->description ? Str::limit($item->description, 160) : null,
                'is_verified' => (bool) $item->is_verified,
            ])->values(),
            'rating_avg' => (float) $this->rating_avg,
            'completed_contracts_count' => (int) $this->completed_contracts_count,
            'is_verified' => $this->verification_status === 'VERIFIED',
        ];
    }
}
