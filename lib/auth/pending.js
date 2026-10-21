// Akun PENDING_VERIFICATION (mahasiswa yang belum diverifikasi kampus/KTM).
//
// Backend (app/Http/Middleware/EnsureUserAccountCanAccessApi.php) hanya
// mengizinkan endpoint ini untuk akun pending; endpoint lain → 403
// ACCOUNT_PENDING_VERIFICATION. Endpoint publik (universitas, kategori, dll.)
// dan /api/broadcasting/auth tidak dibatasi status akun.
export const PENDING_ALLOWED_API = [
  "/auth/logout",
  "/me/profile",
  "/students/me/verification",
  "/students/me/campus-email/verification",
];

// Halaman aplikasi yang tetap bisa dipakai akun pending: fiturnya hanya butuh
// endpoint di atas (atau belum memanggil API sama sekali). Halaman lain
// (cari proyek, proyek, penghasilan, pesan, dst.) diganti penjelasan + tautan ke /verify.
export const PENDING_ALLOWED_PAGES = ["/profile", "/settings", "/help", "/verify"];

export const isPendingUser = (authUser) => authUser?.status === "PENDING_VERIFICATION";

export function pendingCanOpen(pathname) {
  const path = (pathname || "").split("?")[0];
  return PENDING_ALLOWED_PAGES.some((p) => path === p || path.startsWith(`${p}/`));
}
