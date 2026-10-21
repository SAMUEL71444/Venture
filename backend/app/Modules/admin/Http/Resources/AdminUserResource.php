<?php

namespace App\Modules\admin\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Data pengguna untuk panel admin (GET admin/users). Whitelist eksplisit: id, nama,
 * role, status, email & HP (boleh untuk admin), universitas atau nama usaha, tanggal
 * daftar, status verifikasi. Tanpa password, token, path KTM, atau kolom internal lain.
 */
final class AdminUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $student = $this->role === 'STUDENT' ? $this->studentProfile : null;
        $umkm = $this->role === 'UMKM' ? $this->umkmProfile : null;
        $mentor = $this->role === 'MENTOR' ? $this->mentorProfile : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'role' => $this->role,
            'status' => $this->status,
            'email' => $this->email,
            'phone' => $this->phone,
            'university' => $student ? ($student->university?->name ?? $student->university_name_custom) : null,
            'business_name' => $umkm?->business_name,
            'verification_status' => $student?->verification_status ?? $mentor?->verification_status,
            'registered_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
