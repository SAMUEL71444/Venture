// Aturan validasi auth — SATU sumber yang dipakai form (frontend) DAN backend
// (sekarang lib/auth/mock-backend.js; nanti backend asli sebaiknya memakai
// aturan & pesan yang sama). Fungsi murni, tanpa React, tanpa I/O.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const OTP_LENGTH = 6;
export const NAME_MAX = 80;

// Syarat password — urutan di sini = urutan checklist di form daftar.
export const PASSWORD_RULES = [
  { id: "length", label: "Minimal 8 karakter", test: (p) => p.length >= 8 },
  { id: "upper", label: "Huruf besar (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "Huruf kecil (a–z)", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "Angka (0–9)", test: (p) => /\d/.test(p) },
];

export const normalizeEmail = (email) => (email || "").trim().toLowerCase();

export function validateEmail(email) {
  const v = (email || "").trim();
  if (!v) return "Email wajib diisi";
  if (!EMAIL_RE.test(v)) return "Format email tidak valid";
  return null;
}

export function unmetPasswordRules(password) {
  return PASSWORD_RULES.filter((r) => !r.test(password || ""));
}

// Pesan untuk password yang belum memenuhi syarat — menyebut syarat yang
// kurang saja (checklist di bawah field menunjukkan rinciannya).
export function validateNewPassword(password) {
  if (!password) return "Password wajib diisi";
  const unmet = unmetPasswordRules(password);
  if (unmet.length === 0) return null;
  return `Password belum memenuhi syarat: ${unmet.map((r) => r.label.replace(/ \(.*\)$/, "").toLowerCase()).join(", ")}`;
}

// 0 = kosong, 1 = lemah, 2 = sedang, 3 = kuat, 4 = sangat kuat.
export function passwordStrength(password) {
  const p = password || "";
  if (!p) return { level: 0, label: "" };
  const met = PASSWORD_RULES.length - unmetPasswordRules(p).length;
  if (met <= 2) return { level: 1, label: "Lemah" };
  if (met === 3) return { level: 2, label: "Sedang" };
  const extra = p.length >= 12 || /[^A-Za-z0-9]/.test(p);
  return extra ? { level: 4, label: "Sangat kuat" } : { level: 3, label: "Kuat" };
}

// Login hanya memeriksa kelengkapan & format — kecocokan password urusan
// backend (pesan gagalnya sengaja umum, lihat lib/auth/api.js).
export function validateLogin({ email, password }) {
  const errors = {};
  const e = validateEmail(email);
  if (e) errors.email = e;
  if (!password) errors.password = "Password wajib diisi";
  return errors;
}

// `nameLabel` mis. "Nama lengkap" / "Nama usaha" (beda per jenis akun).
export function validateRegister({ name, email, password, confirm, agree }, { nameLabel = "Nama" } = {}) {
  const errors = {};
  const n = (name || "").trim();
  if (!n) errors.name = `${nameLabel} wajib diisi`;
  else if (n.length < 2) errors.name = `${nameLabel} minimal 2 karakter`;
  else if (n.length > NAME_MAX) errors.name = `${nameLabel} maksimal ${NAME_MAX} karakter`;
  const e = validateEmail(email);
  if (e) errors.email = e;
  const p = validateNewPassword(password);
  if (p) errors.password = p;
  if (!confirm) errors.confirm = "Konfirmasi password wajib diisi";
  else if (confirm !== password) errors.confirm = "Password tidak cocok";
  if (!agree) errors.agree = "Kamu perlu menyetujui Syarat & Ketentuan dan Kebijakan Privasi";
  return errors;
}

export function validateOtp(code) {
  if (!code) return "Masukkan kode verifikasi";
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code)) return `Kode terdiri dari ${OTP_LENGTH} digit angka`;
  return null;
}

// "0:27" / "4:59" — dipakai pesan countdown kunci & kirim ulang.
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
