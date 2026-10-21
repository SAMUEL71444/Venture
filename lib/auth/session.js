// Penyimpanan sesi auth di browser.
//
// - Access token (umur 15 menit) HANYA di memori modul ini: hilang saat reload,
//   lalu dipulihkan lewat refresh token pada request pertama yang kena 401.
// - Refresh token (umur 30 hari) di localStorage supaya sesi bertahan setelah
//   browser ditutup. RISIKO XSS: skrip jahat yang berhasil jalan di origin ini
//   bisa membacanya. Mitigasinya: jangan pernah merender HTML dari input pengguna
//   (dangerouslySetInnerHTML), jaga dependensi, dan pertimbangkan pindah ke cookie
//   httpOnly bila backend kelak memakai mode SPA/cookie Sanctum. Backend sudah
//   memutar (rotate) refresh token tiap dipakai dan mencabut semua sesi bila token
//   lama dipakai ulang, jadi token curian berumur pendek.
// - Ringkasan user (tanpa rahasia) disimpan untuk tampilan.

const REFRESH_KEY = "digitalin.refreshToken";
const USER_KEY = "digitalin.authUser";
export const SESSION_ENDED_EVENT = "digitalin:session-ended";
// Backend menjawab 403 ACCOUNT_PENDING_VERIFICATION (lihat lib/api.js).
export const ACCOUNT_PENDING_EVENT = "digitalin:account-pending";

let accessToken = null;

export const getAccessToken = () => accessToken;

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

/** `tokens` = objek `tokens` dari backend (access_token, refresh_token, ...). */
export function setTokens(tokens) {
  accessToken = tokens?.access_token || null;
  try {
    if (tokens?.refresh_token) localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  } catch { /* storage diblokir: sesi hanya bertahan sampai reload */ }
}

export function setAuthUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch { /* abaikan */ }
}

export function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

/** Tandai user tersimpan sebagai PENDING_VERIFICATION dan beri tahu RoleContext. */
export function markAccountPending() {
  const user = getAuthUser();
  if (user && user.status !== "PENDING_VERIFICATION") setAuthUser({ ...user, status: "PENDING_VERIFICATION" });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ACCOUNT_PENDING_EVENT));
}

/**
 * Hapus sesi lokal. `reason`: "logout" | "expired" | "suspended" | "restore-failed".
 * "expired"/"suspended" saat user sedang login → RoleContext mengarahkan ke /login?reason=...
 */
export function clearSession(reason = "logout") {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* abaikan */ }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { reason } }));
  }
}
