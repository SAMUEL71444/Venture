// PINTU TUNGGAL auth untuk halaman Login, Daftar, dan Verifikasi Email.
// Halaman TIDAK pernah memanggil backend langsung — selalu lewat fungsi di
// sini, dan selalu menerima bentuk hasil yang sama:
//   { ok: true, data }
//   { ok: false, error: { code, message, fields?, retryAfter?, attemptsLeft?, role?, email? } }
//
// SEKARANG: memakai backend sementara di browser (./mock-backend.js).
// SAAT MENGGABUNGKAN BACKEND ASLI: ganti isi tiap fungsi dengan fetch() ke
// endpoint-nya, petakan respons ke `code` di bawah, lalu set USE_MOCK=false
// (panel "Mode demo" kode OTP otomatis hilang). Halaman tidak perlu diubah.
import {
  mockLogin, mockRegister, mockVerifyOtp, mockResendOtp, mockVerificationStatus,
  readDemoOutbox, DEMO_ACCOUNTS, UNVERIFIED_DEMO,
} from "./mock-backend";
import { formatCountdown } from "./validation";

export const USE_MOCK = true;

// Pesan per kode error. Sengaja di frontend supaya teksnya konsisten apa pun
// bahasa pesan dari backend.
const MESSAGES = {
  NETWORK: "Tidak dapat terhubung ke server, coba lagi",
  INVALID_CREDENTIALS: "Email atau password salah", // email tak terdaftar ATAU password salah — sengaja sama
  UNVERIFIED: "Akun belum diverifikasi",
  ROLE_MISMATCH: "Akun ini terdaftar dengan peran lain",
  LOCKED: "Terlalu banyak percobaan gagal",
  EMAIL_TAKEN: "Email sudah terdaftar, silakan login",
  VALIDATION: "Periksa kembali isian yang ditandai",
  OTP_INVALID: "Kode salah",
  OTP_EXPIRED: "Kode sudah kedaluwarsa, kirim ulang kode",
  OTP_LOCKED: "Terlalu banyak percobaan salah",
  OTP_COOLDOWN: "Tunggu sebentar sebelum mengirim ulang kode",
  ALREADY_VERIFIED: "Email ini sudah terverifikasi",
  NOT_FOUND: "Akun untuk email ini tidak ditemukan",
  UNKNOWN: "Terjadi kesalahan, coba lagi",
};

export const messageFor = (code) => MESSAGES[code] || MESSAGES.UNKNOWN;
export { formatCountdown };

// Jalankan satu panggilan: error melempar (jaringan putus, server mati,
// respons rusak) diseragamkan jadi code "NETWORK".
async function call(fn) {
  try {
    const res = await fn();
    if (res.ok) return res;
    return { ok: false, error: { ...res.error, message: messageFor(res.error.code) } };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: MESSAGES.NETWORK } };
  }
}

/** Masuk. `role` = peran yang dipilih di form (harus cocok dengan akun). */
export const login = ({ email, password, role }) => call(() => mockLogin({ email, password, role }));

/** Daftar akun baru (status belum terverifikasi) + kirim kode OTP ke email. */
export const register = (payload) => call(() => mockRegister(payload));

/** Status verifikasi email: { verified, role, resendIn, lockedFor, expiresIn, attemptsLeft, hasCode }. */
export const getVerificationStatus = ({ email }) => call(() => mockVerificationStatus({ email }));

/** Kirim ulang kode OTP. */
export const resendOtp = ({ email }) => call(() => mockResendOtp({ email }));

/** Cek kode OTP 6 digit. */
export const verifyOtp = ({ email, code }) => call(() => mockVerifyOtp({ email, code }));

// --- khusus mode demo (hilang otomatis saat USE_MOCK=false) ---------------
/** Kode OTP terakhir yang "dikirim" ke email ini — pengganti kotak masuk email. */
export const demoOutbox = (email) => (USE_MOCK ? readDemoOutbox(email) : null);
export const demoAccounts = USE_MOCK ? DEMO_ACCOUNTS : {};
export const demoUnverified = USE_MOCK ? UNVERIFIED_DEMO : null;
