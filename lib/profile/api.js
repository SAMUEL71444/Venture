// Pemanggil API profil & pengaturan milik sendiri (semua role). Mengembalikan
// { ok: true, data } atau { ok: false, error: { code, status, message, fields } }.
// `fields` = pesan validasi backend per field (VALIDATION_FAILED), mis. { name: "..." }.
// Token & refresh ditangani lib/api.js.
import { api, parseApiError } from "@/lib/api";
import { setAuthUser } from "@/lib/auth/session";

const ROLE_FROM_BACKEND = { UMKM: "umkm", STUDENT: "mahasiswa", ADMIN: "trust" };

const MESSAGES = {
  NETWORK: "Tidak dapat terhubung ke server, coba lagi",
  UNAUTHENTICATED: "Sesi berakhir, silakan masuk lagi",
  FORBIDDEN: "Akun ini belum bisa memakai fitur ini",
  ACCOUNT_PENDING_VERIFICATION: "Tersedia setelah akunmu terverifikasi",
  VALIDATION_FAILED: "Periksa kembali isian yang ditandai",
  TOO_MANY_REQUESTS: "Terlalu banyak permintaan, tunggu sebentar",
  SERVICE_UNAVAILABLE: "Layanan sedang tidak tersedia, coba lagi nanti",
};

function firstMessages(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  return Object.fromEntries(Object.entries(details).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]));
}

async function call(fn) {
  try {
    const res = await fn();
    return { ok: true, data: res.data?.data };
  } catch (err) {
    const e = parseApiError(err);
    const fields = e.code === "VALIDATION_FAILED" ? firstMessages(e.details) : {};
    return {
      ok: false,
      error: { code: e.code, status: e.status, message: MESSAGES[e.code] || e.message || "Terjadi kesalahan, coba lagi", fields },
    };
  }
}

/** Ringkasan user sesi ikut diperbarui (nama di sidebar, menu pengguna, sapaan dashboard). */
function syncSessionUser(user) {
  const appRole = ROLE_FROM_BACKEND[user?.role];
  if (appRole) setAuthUser({ ...user, appRole });
}

import { USE_SUPABASE } from "@/lib/auth/api";
import { supabaseProfileApi } from "@/lib/supabase/profile";

const laravelProfileApi = {
  /** → { user, profile } (profile null untuk admin). */
  me: async () => {
    const res = await call(() => api.get("/me/profile"));
    if (res.ok) syncSessionUser(res.data.user);
    return res;
  },
  /** PUT /me/profile — hanya field yang didukung per peran (lihat ProfileController). */
  update: async (patch) => {
    const res = await call(() => api.put("/me/profile", patch));
    if (res.ok) syncSessionUser(res.data.user);
    return res;
  },
  categories: () => call(() => api.get("/categories")),
  /** Mengganti SELURUH daftar skill (backend: minimal 1). */
  saveSkills: (skills) => call(() => api.put("/students/me/skills", { skills })),
  addPortfolio: (item) => call(() => api.post("/students/me/portfolio", item)),
  certificates: () => call(() => api.get("/students/me/certificates")),
  bankAccounts: () => call(() => api.get("/bank-accounts")),
  addBankAccount: (input) => call(() => api.post("/bank-accounts", input)),
};

// Pakai Supabase saat aktif; kalau tidak, backend Laravel.
export const profileApi = USE_SUPABASE ? supabaseProfileApi : laravelProfileApi;

export const LEVELS = [
  { id: "BEGINNER", label: "Pemula" },
  { id: "INTERMEDIATE", label: "Menengah" },
  { id: "ADVANCED", label: "Mahir" },
];
export const levelLabel = (id) => LEVELS.find((l) => l.id === id)?.label || id;

export const ACCOUNT_STATUS = {
  ACTIVE: { label: "Aktif", cls: "badge-success" },
  PENDING_VERIFICATION: { label: "Menunggu verifikasi", cls: "badge-warning" },
  SUSPENDED: { label: "Ditangguhkan", cls: "badge-error" },
};

export const VERIFICATION_STATUS = {
  VERIFIED: { label: "Terverifikasi", cls: "badge-success" },
  PENDING: { label: "Belum terverifikasi", cls: "badge-warning" },
  REJECTED: { label: "Ditolak", cls: "badge-error" },
};

export const ROLE_LABEL = { STUDENT: "Mahasiswa", UMKM: "Pemilik UMKM", ADMIN: "Verify & Trust", MENTOR: "Mentor" };

export function formatJoined(iso) {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return "-";
  }
}
