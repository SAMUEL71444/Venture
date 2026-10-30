// PINTU TUNGGAL auth untuk halaman Login, Daftar, Verifikasi, dan Lupa Password.
// Halaman TIDAK pernah memanggil backend langsung — selalu lewat fungsi di
// sini, dan selalu menerima bentuk hasil yang sama:
//   { ok: true, data }
//   { ok: false, error: { code, message, fields?, retryAfter?, attemptsLeft? } }
//
// USE_MOCK=true (NEXT_PUBLIC_AUTH_MOCK=true) memakai backend tiruan di browser
// (./mock-backend.js) dan memunculkan panel "Mode demo" berisi kode OTP.
// USE_MOCK=false memanggil backend Laravel lewat lib/api.js.
import { api, parseApiError, refreshSession } from "@/lib/api";
import { getRefreshToken, setTokens, setAuthUser, getAuthUser, clearSession } from "./session";
import { AuthFlowError } from "./errors";
import * as mock from "./mock-backend";
import { formatCountdown, UNIVERSITY_CUSTOM } from "./validation";

export const USE_MOCK = process.env.NEXT_PUBLIC_AUTH_MOCK === "true";

// Peran backend ↔ peran aplikasi web. MENTOR belum punya tampilan web.
export const ROLE_FROM_BACKEND = { UMKM: "umkm", STUDENT: "mahasiswa", ADMIN: "trust" };
export const ROLE_TO_BACKEND = { umkm: "UMKM", mahasiswa: "STUDENT", trust: "ADMIN" };

// Pesan per kode error. Sengaja di frontend supaya bahasanya konsisten,
// apa pun bahasa pesan dari backend.
const MESSAGES = {
  NETWORK: "Tidak dapat terhubung ke server, coba lagi",
  INVALID_CREDENTIALS: "Email/nomor WhatsApp atau password salah", // sengaja umum (anti-enumerasi)
  LOCKED: "Terlalu banyak percobaan gagal",
  RATE_LIMITED: "Terlalu banyak permintaan, tunggu sebentar",
  ROLE_UNSUPPORTED: "Akun ini belum bisa dipakai di aplikasi web",
  ACCOUNT_SUSPENDED: "Akun ini sedang ditangguhkan",
  PENDING_VERIFICATION: "Akun belum selesai diverifikasi",
  SESSION_EXPIRED: "Sesi berakhir, silakan masuk lagi",
  IDENTIFIER_TAKEN: "Sudah terdaftar, silakan masuk",
  VALIDATION: "Periksa kembali isian yang ditandai",
  OTP_INVALID: "Kode salah",
  OTP_EXPIRED: "Kode sudah kedaluwarsa, kirim ulang kode",
  OTP_INVALID_OR_EXPIRED: "Kode salah atau sudah kedaluwarsa",
  OTP_LOCKED: "Terlalu banyak percobaan salah. Minta kode baru",
  OTP_COOLDOWN: "Tunggu sebentar sebelum mengirim ulang kode",
  DELIVERY_FAILED: "Kode belum bisa dikirim saat ini, coba lagi nanti",
  VERIFICATION_EXPIRED: "Verifikasi kontak sudah kedaluwarsa, minta kode baru",
  RESET_EXPIRED: "Sesi reset password sudah kedaluwarsa, ulangi dari awal",
  UNKNOWN: "Terjadi kesalahan, coba lagi",
  CAMPUS_EMAIL_NOT_AVAILABLE: "Kampusmu belum mendukung verifikasi lewat email. Verifikasi dengan unggah KTM",
  KTM_NOT_ALLOWED: "Unggah KTM tidak tersedia untuk status akunmu saat ini",
  VERIFICATION_ATTEMPTS_EXCEEDED: "Batas 3 kali pengajuan verifikasi sudah tercapai",
  ALREADY_PROCESSED: "Verifikasi ini sudah diproses",
};

export const messageFor = (code) => MESSAGES[code] || MESSAGES.UNKNOWN;
export { formatCountdown };

// --- pemetaan error backend → kode frontend ---------------------------------
// Berdasarkan `error.code` saja — teks pesan backend tidak pernah dicocokkan.

// Pesan per field untuk VALIDATION_FAILED. Format isian sudah dicek di
// frontend, jadi kegagalan dari backend cukup dijelaskan per field.
const FIELD_MAP = {
  business_name: "name", name: "name", email: "identifier", phone: "identifier", identifier: "identifier",
  channel: "identifier", password: "password", university_id: "university", campus_email: "campusEmail",
  university_name_custom: "universityCustom",
  code: "code", city: "city", ktm: "ktm",
};
const FIELD_MESSAGES = {
  name: "Nama tidak valid",
  identifier: "Email/nomor WhatsApp tidak valid atau sudah terdaftar",
  password: "Password tidak memenuhi syarat",
  university: "Pilih universitas yang valid",
  universityCustom: "Nama universitas wajib diisi, maksimal 150 karakter",
  campusEmail: "Email kampus tidak valid atau sudah dipakai akun lain",
  city: "Kota tidak valid",
  code: "Kode tidak valid",
  ktm: "File KTM harus PDF, JPG, atau PNG dan maksimal 5 MB",
};

function mapFields(details) {
  const fields = {};
  for (const key of Object.keys(details || {})) {
    const field = FIELD_MAP[key] || key;
    fields[field] = FIELD_MESSAGES[field] || "Isian tidak valid";
  }
  return fields;
}

// Kode backend yang padanannya satu-satu.
const CODE_MAP = {
  NETWORK: "NETWORK",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  IDENTIFIER_ALREADY_REGISTERED: "IDENTIFIER_TAKEN",
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_MAX_ATTEMPTS: "OTP_LOCKED",
  VERIFICATION_TOKEN_INVALID: "VERIFICATION_EXPIRED",
  RESET_TOKEN_INVALID: "RESET_EXPIRED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_PENDING_VERIFICATION: "PENDING_VERIFICATION",
  UNAUTHENTICATED: "SESSION_EXPIRED",
  SERVICE_UNAVAILABLE: "DELIVERY_FAILED",
};

// context: "otp" | "reset-otp" | "register" | "login" | "reset" | "data"
function mapError(e, context) {
  switch (e.code) {
    case "TOO_MANY_REQUESTS":
      return { code: context === "login" ? "LOCKED" : "RATE_LIMITED", retryAfter: e.retryAfter || 60 };
    case "OTP_RESEND_COOLDOWN":
      return { code: "OTP_COOLDOWN", retryAfter: e.retryAfter || 60 };
    case "OTP_INVALID":
      // Reset password: backend sengaja tidak memberi sisa percobaan (anti-enumerasi).
      return context === "reset-otp"
        ? { code: "OTP_INVALID_OR_EXPIRED" }
        : { code: "OTP_INVALID", attemptsLeft: e.details?.attempts_remaining };
    case "CAMPUS_EMAIL_NOT_AVAILABLE":
      // Saat daftar: tandai field email kampus. Di /verify: arahkan ke unggah KTM.
      return context === "register"
        ? { code: "VALIDATION", fields: { campusEmail: "Universitas ini belum mendukung verifikasi email kampus. Kosongkan, lalu verifikasi lewat unggah KTM setelah daftar" } }
        : { code: "CAMPUS_EMAIL_NOT_AVAILABLE" };
    case "KTM_VERIFICATION_NOT_ALLOWED":
      return { code: "KTM_NOT_ALLOWED" };
    case "VERIFICATION_ATTEMPTS_EXCEEDED":
      return { code: "VERIFICATION_ATTEMPTS_EXCEEDED" };
    case "INVALID_STATE_TRANSITION":
      return { code: "ALREADY_PROCESSED" };
    case "CAMPUS_EMAIL_DOMAIN_MISMATCH":
      return { code: "VALIDATION", fields: { campusEmail: "Domain email kampus tidak sesuai universitas yang dipilih" } };
    case "VALIDATION_FAILED": {
      const fields = mapFields(e.details);
      // Saat daftar, kontak sudah lolos cek format + OTP, jadi kegagalan field
      // email/phone berarti kontak itu baru saja dipakai akun lain.
      if (context === "register" && fields.identifier) return { code: "IDENTIFIER_TAKEN", fields };
      return { code: "VALIDATION", fields };
    }
    default:
      return { code: CODE_MAP[e.code] || "UNKNOWN" };
  }
}

async function call(fn, context) {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const e = err instanceof AuthFlowError ? { code: err.code, ...err.extra } : mapError(parseApiError(err), context);
    return { ok: false, error: { ...e, message: messageFor(e.code) } };
  }
}

// --- backend asli -------------------------------------------------------------
const otpPath = (purpose, action) => (purpose === "reset" ? `/auth/password/otp/${action}` : `/auth/otp/${action}`);

const real = {
  async sendOtp({ purpose, channel, identifier }) {
    const { data } = await api.post(otpPath(purpose, "send"), { channel, identifier });
    return { expiresAt: Date.parse(data.data.expires_at), resendAfter: data.data.resend_after_seconds };
  },
  async verifyOtp({ purpose, channel, identifier, code }) {
    const { data } = await api.post(otpPath(purpose, "verify"), { channel, identifier, code });
    return { token: data.data.reset_token || data.data.verification_token, expiresIn: data.data.expires_in_seconds };
  },
  async register({ type, channel, identifier, token, values }) {
    const common = {
      channel,
      ...(channel === "email" ? { email: identifier } : { phone: identifier }),
      verification_token: token,
      password: values.password,
    };
    const payload = type === "umkm"
      ? { ...common, business_name: values.name.trim(), city: values.city?.trim() || null }
      : {
        ...common,
        name: values.name.trim(),
        // Tepat salah satu: universitas dari daftar ATAU nama yang diketik sendiri (tanpa email kampus).
        ...(values.university === UNIVERSITY_CUSTOM
          ? { university_name_custom: values.universityCustom.trim(), campus_email: null }
          : { university_id: values.university, campus_email: values.campusEmail?.trim() || null }),
      };
    const { data } = await api.post(type === "umkm" ? "/auth/register/umkm" : "/auth/register/student", payload);
    return data.data;
  },
  async login({ identifier, password }) {
    const { data } = await api.post("/auth/login", { identifier, password });
    return data.data;
  },
  async logout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) await api.post("/auth/logout", { refresh_token: refreshToken });
  },
  async resetPassword({ channel, identifier, token, password, confirm }) {
    await api.post("/auth/password/reset", {
      channel, identifier, reset_token: token, password, password_confirmation: confirm,
    });
    return true;
  },
  async universities() {
    const { data } = await api.get("/universities");
    return data.data;
  },
  async myProfile() {
    const { data } = await api.get("/me/profile");
    return data.data;
  },
  async uploadKtm(file) {
    const form = new FormData();
    form.append("ktm", file);
    const { data } = await api.post("/students/me/verification", form);
    return data.data;
  },
  async sendCampusEmailVerification() {
    const { data } = await api.post("/students/me/campus-email/verification");
    return data.data;
  },
};

const backend = USE_MOCK ? mock : real;

/** Simpan token + ringkasan user. null jika peran belum didukung web. */
function startSession(result) {
  const appRole = ROLE_FROM_BACKEND[result.user?.role];
  setTokens(result.tokens);
  if (!appRole) return null;
  const user = { ...result.user, appRole };
  setAuthUser(user);
  return user;
}

// --- fungsi untuk halaman -------------------------------------------------------
/** purpose: "register" | "reset". Untuk "reset" hasilnya selalu sukses (anti-enumerasi). */
export const sendOtp = (input) => call(() => backend.sendOtp(input), input.purpose === "reset" ? "reset-otp" : "otp");

/** → { token, expiresIn } (verification_token untuk daftar / reset_token untuk reset). */
export const verifyOtp = (input) => call(() => backend.verifyOtp(input), input.purpose === "reset" ? "reset-otp" : "otp");

/** Daftar dengan kontak yang sudah terverifikasi. → { user } (user.appRole = peran web). */
export const register = (input) => call(async () => {
  const user = startSession(await backend.register(input));
  return { user };
}, "register");

/** Masuk dengan email/nomor WA + password. Peran datang dari backend. */
export const login = (input) => call(async () => {
  const user = startSession(await backend.login(input));
  if (!user) {
    // Mis. MENTOR: belum ada tampilan web — cabut sesi yang baru dibuat.
    await backend.logout().catch(() => {});
    clearSession("logout");
    throw new AuthFlowError("ROLE_UNSUPPORTED");
  }
  return { user };
}, "login");

/**
 * Pulihkan sesi saat aplikasi dimuat: refresh token → /auth/refresh → /me/profile.
 * → { status: "authenticated", user } | { status: "anonymous" } | { status: "unreachable" }.
 * Token hanya dihapus bila backend MENOLAK refresh token (401, lihat refreshSession di
 * lib/api.js) atau akun ditangguhkan. Server mati / timeout / 5xx → "unreachable",
 * token dipertahankan supaya bisa dicoba lagi tanpa login ulang.
 */
export async function restoreSession() {
  if (!getRefreshToken()) return { status: "anonymous" };
  if (USE_MOCK) {
    const user = getAuthUser();
    return user?.appRole ? { status: "authenticated", user } : { status: "anonymous" };
  }
  try {
    await refreshSession();
    const { data } = await api.get("/me/profile");
    const { id, name, email, phone, role, status, joined_at } = data.data.user;
    const appRole = ROLE_FROM_BACKEND[role];
    if (!appRole) {
      // Peran tanpa tampilan web (mis. MENTOR): cabut sesinya juga di backend.
      await real.logout().catch(() => {});
      clearSession("restore-failed");
      return { status: "anonymous" };
    }
    const user = { id, name, email, phone, role, status, joined_at, appRole };
    setAuthUser(user);
    return { status: "authenticated", user };
  } catch (err) {
    // Refresh token ditolak (401) / akun ditangguhkan sudah menghapus sesi lebih dulu.
    if (!getRefreshToken()) return { status: "anonymous" };
    const { status } = parseApiError(err);
    // Tidak ada respons, timeout, rate limit, atau galat server: coba lagi nanti.
    if (status === 0 || status === 408 || status === 429 || status >= 500) return { status: "unreachable" };
    // Respons 4xx lain dari /me/profile (mis. ACCOUNT_UNAVAILABLE): tidak bisa masuk,
    // tetapi token tidak dihapus karena bukan penolakan refresh token.
    return { status: "anonymous" };
  }
}

/** Keluar: cabut refresh token di backend, lalu hapus sesi lokal apa pun hasilnya. */
export async function logout() {
  try {
    await backend.logout();
  } catch { /* tetap keluar secara lokal */ }
  clearSession("logout");
}

export const resetPassword = (input) => call(() => backend.resetPassword(input), "reset");

export const getUniversities = () => call(() => backend.universities(), "data");

// --- verifikasi identitas (/verify) -------------------------------------------
/** → { user, profile } dari /me/profile; user juga disimpan sebagai ringkasan sesi. */
export const getMyProfile = () => call(async () => {
  const result = await backend.myProfile();
  const appRole = ROLE_FROM_BACKEND[result.user?.role];
  if (appRole) setAuthUser({ ...result.user, appRole });
  return { user: { ...result.user, appRole }, profile: result.profile };
}, "verify");

/** Unggah KTM (PDF/JPG/PNG, maks. 5 MB) → { verification_status }. */
export const uploadKtm = (file) => call(() => backend.uploadKtm(file), "verify");

/** Kirim ulang tautan verifikasi ke email kampus. */
export const sendCampusEmailVerification = () => call(() => backend.sendCampusEmailVerification(), "verify");

// --- khusus mode demo (kosong saat USE_MOCK=false) ---------------------------
/** Kode OTP terakhir yang "dikirim" ke kontak ini — pengganti kotak masuk. */
export const demoOutbox = (channel, identifier) => (USE_MOCK ? mock.readDemoOutbox(channel, identifier) : null);
export const demoAccounts = USE_MOCK ? mock.DEMO_ACCOUNTS : [];
