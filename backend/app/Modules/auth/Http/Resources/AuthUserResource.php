<?php

namespace App\Modules\auth\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Data user milik sendiri (login, registrasi, /me/profile). Whitelist eksplisit:
 * hanya field yang dipakai frontend — lib/auth/api.js (startSession, restoreSession),
 * context/RoleContext.js, components/layout/AppShell.js, app/login/page.js.
 * Kolom lain (password_hash, remember_token, timestamp internal) tidak pernah dikirim.
 */
final class AuthUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role,
            'status' => $this->status,
            // Tanggal bergabung (halaman Profil/Pengaturan). Sengaja bukan 'created_at'.
            'joined_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
