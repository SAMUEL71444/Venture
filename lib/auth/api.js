// PINTU TUNGGAL auth untuk halaman Login, Daftar, Verifikasi, dan Lupa Password.
// Halaman TIDAK pernah memanggil backend langsung — selalu lewat fungsi di
// sini, dan selalu menerima bentuk hasil yang sama:
//   { ok: true, data }
//   { ok: false, error: { code, message, fields?, retryAfter?, attemptsLeft? } }
//
// USE_MOCK=true (NEXT_PUBLIC_AUTH_MOCK=true) memakai backend tiruan di browser
// (./mock-backend.js) dan memunculkan panel "Mode demo" berisi kode OTP.
// USE_MOCK=false memanggil backend Laravel lewat lib/api.js.
import { api, parseApiError } from "@/lib/api";
import { getRefreshToken, setTokens, setAuthUser, clearSession } from "./session";
import { AuthFlowError } from "./errors";
import * as mock from "./mock-backend";
import { formatCountdown } from "./validation";

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
};

export const messageFor = (code) => MESSAGES[code] || MESSAGES.UNKNOWN;
export { formatCountdown };

// --- pemetaan error backend → kode frontend ---------------------------------
const FIELD_MAP = {
  business_name: "name", name: "name", email: "identifier", phone: "identifier", identifier: "identifier",
  channel: "identifier", password: "password", university_id: "university", campus_email: "campusEmail",
  code: "code", city: "city",
};

function translate(field, msg) {
  if (/already been taken/i.test(msg)) return field === "campusEmail" ? "Email kampus sudah dipakai akun lain" : "Sudah terdaftar, silakan masuk";
  if (/confirmation/i.test(msg)) return "Password tidak cocok";
  if (/valid email/i.test(msg)) return "Format email tidak valid";
  if (/format is invalid/i.test(msg)) return "Format tidak valid";
  if (/at least|must not be greater/i.test(msg)) return "Panjang isian tidak sesuai";
  if (/required/i.test(msg)) return "Wajib diisi";
  return "Isian tidak valid";
}

function mapFields(details) {
  const fields = {};
  for (const [key, msgs] of Object.entries(details || {})) {
    const field = FIELD_MAP[key] || key;
    if (!fields[field]) fields[field] = translate(field, Array.isArray(msgs) ? msgs[0] : String(msgs));
  }
  return fields;
}

// Backend memakai satu kode BUSINESS_RULE_VIOLATION untuk banyak kasus, jadi
// pesannya dicocokkan di sini. Jika teks pesan backend diubah, perbarui pola ini.
function mapError(e, context) {
  const m = e.message || "";
  switch (e.code) {
    case "NETWORK": return { code: "NETWORK" };
    case "TOO_MANY_REQUESTS": return { code: context === "login" ? "LOCKED" : "RATE_LIMITED", retryAfter: e.retryAfter || 60 };
    case "UNAUTHENTICATED": return { code: context === "login" ? "INVALID_CREDENTIALS" : "SESSION_EXPIRED" };
    case "ACCOUNT_SUSPENDED": return { code: "ACCOUNT_SUSPENDED" };
    case "ACCOUNT_PENDING_VERIFICATION": return { code: "PENDING_VERIFICATION" };
    case "VALIDATION_FAILED": {
      const fields = mapFields(e.details);
      if (/sudah terdaftar/.test(fields.identifier || "")) return { code: "IDENTIFIER_TAKEN", fields };
      return { code: "VALIDATION", fields };
    }
    case "BUSINESS_RULE_VIOLATION":
      if (/already registered/i.test(m)) return { code: "IDENTIFIER_TAKEN" };
      if (/wait before requesting/i.test(m)) return { code: "OTP_COOLDOWN", retryAfter: e.retryAfter || 60 };
      if (/attempt limit/i.test(m)) return { code: "OTP_LOCKED" };
      if (/^OTP is invalid or expired/i.test(m)) {
        return e.details?.attempts_remaining != null
          ? { code: "OTP_INVALID", attemptsLeft: e.details.attempts_remaining }
          : { code: "OTP_EXPIRED" };
      }
      if (/verification code is invalid or expired/i.test(m)) return { code: "OTP_INVALID_OR_EXPIRED" };
      if (/verification is missing or expired/i.test(m)) return { code: "VERIFICATION_EXPIRED" };
      if (/password reset session/i.test(m)) return { code: "RESET_EXPIRED" };
      if (/campus email domain/i.test(m)) {
        return { code: "VALIDATION", fields: { campusEmail: "Domain email kampus tidak sesuai universitas yang dipilih" } };
      }
      return { code: "UNKNOWN" };
    default:
      return { code: e.status === 503 ? "DELIVERY_FAILED" : "UNKNOWN" };
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
      : { ...common, name: values.name.trim(), university_id: values.university, campus_email: values.campusEmail?.trim() || null };
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
export const sendOtp = (input) => call(() => backend.sendOtp(input), "otp");

/** → { token, expiresIn } (verification_token untuk daftar / reset_token untuk reset). */
export const verifyOtp = (input) => call(() => backend.verifyOtp(input), "otp");

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

/** Keluar: cabut refresh token di backend, lalu hapus sesi lokal apa pun hasilnya. */
export async function logout() {
  try {
    await backend.logout();
  } catch { /* tetap keluar secara lokal */ }
  clearSession("logout");
}

export const resetPassword = (input) => call(() => backend.resetPassword(input), "reset");

export const getUniversities = () => call(() => backend.universities(), "data");

// --- khusus mode demo (kosong saat USE_MOCK=false) ---------------------------
/** Kode OTP terakhir yang "dikirim" ke kontak ini — pengganti kotak masuk. */
export const demoOutbox = (channel, identifier) => (USE_MOCK ? mock.readDemoOutbox(channel, identifier) : null);
export const demoAccounts = USE_MOCK ? mock.DEMO_ACCOUNTS : [];
