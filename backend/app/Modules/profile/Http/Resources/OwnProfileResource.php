<?php

namespace App\Modules\profile\Http\Resources;

use App\Models\AuditLog;
use App\Models\MentorProfile;
use App\Models\StudentProfile;
use App\Models\UmkmProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Profil milik sendiri per peran (registrasi, GET/PUT /me/profile). Whitelist
 * eksplisit: field yang bisa diubah lewat PUT /me/profile + status verifikasi.
 * Tidak mengirim user_id, path KTM, verifikator, rating/penghitung kontrak, timestamp.
 */
final class OwnProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return match (true) {
            $this->resource instanceof StudentProfile => $this->student(),
            $this->resource instanceof UmkmProfile => $this->umkm(),
            $this->resource instanceof MentorProfile => $this->mentor(),
            default => [],
        };
    }

    private function student(): array
    {
        $university = $this->university;

        return [
            'id' => $this->id,
            'university' => $university ? ['id' => $university->id, 'name' => $university->name] : null,
            'university_name_custom' => $this->university_name_custom,
            'nim' => $this->nim,
            'major' => $this->major,
            'semester' => $this->semester,
            'bio' => $this->bio,
            'is_available' => (bool) $this->is_available,
            'campus_email' => $this->campus_email,
            'campus_email_verified_at' => $this->campus_email_verified_at?->toIso8601String(),
            // Dipakai halaman /verify (app/verify/page.js).
            'verification_status' => $this->verification_status,
            'has_ktm' => $this->has_ktm,
            'verification_rejection_reason' => $this->verification_status === 'REJECTED' ? $this->rejectionReason() : null,
        ];
    }

    private function umkm(): array
    {
        return [
            'id' => $this->id,
            'business_name' => $this->business_name,
            'business_type' => $this->business_type,
            'address' => $this->address,
            'city' => $this->city,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'instagram_url' => $this->instagram_url,
        ];
    }

    private function mentor(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'institution' => $this->institution,
            'bio' => $this->bio,
            'is_available' => (bool) $this->is_available,
            'verification_status' => $this->verification_status,
            'expertises' => $this->expertises->map(fn ($category) => ['id' => $category->id, 'name' => $category->name])->values(),
        ];
    }

    /** Alasan penolakan KTM terakhir — tersimpan di audit log keputusan admin. */
    private function rejectionReason(): ?string
    {
        $after = AuditLog::query()
            ->where('entity_type', StudentProfile::class)
            ->where('entity_id', $this->id)
            ->where('action', 'STUDENT_KTM_reject')
            ->latest('created_at')
            ->first()?->after_data;

        return is_array($after) ? ($after['reason'] ?? null) : null;
    }
}
