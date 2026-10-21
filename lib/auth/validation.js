// Aturan validasi auth di frontend — fungsi murni, tanpa React, tanpa I/O.
// Backend tetap memvalidasi ulang (lihat backend AuthController); aturan di sini
// sama atau lebih ketat supaya kesalahan tertangkap sebelum request dikirim.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Sama dengan backend: E.164, mis. +6281234567890.
export const PHONE_E164_RE = /^\+[1-9][0-9]{7,14}$/;
export const OTP_LENGTH = 6;
export const NAME_MAX = 80;
// Nilai `university` bila mahasiswa memilih "Universitas saya tidak ada di daftar".
export const UNIVERSITY_CUSTOM = "__custom__";
export const UNIVERSITY_CUSTOM_MAX = 150;

// Syarat password — urutan di sini = urutan checklist di form. Backend hanya
// mewajibkan 8–128 karakter; aturan huruf/angka tambahan khusus frontend.
export const PASSWORD_RULES = [
  { id: "length", label: "Minimal 8 karakter", test: (p) => p.length >= 8 },
  { id: "upper", label: "Huruf besar (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "Huruf kecil (a–z)", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "Angka (0–9)", test: (p) => /\d/.test(p) },
];
export const PASSWORD_MAX = 128;

export const normalizeEmail = (email) => (email || "").trim().toLowerCase();

/**
 * Nomor HP Indonesia → E.164 (+62…). Menerima "0812-3456-7890", "62812…",
 * "812…", atau "+62 812…". Nomor dengan "+" kode negara lain dibiarkan.
 */
export function normalizePhone(input) {
  const v = (input || "").replace(/[\s\-().]/g, "");
  if (!v) return "";
  if (v.startsWith("+")) return v;
  if (v.startsWith("00")) return `+${v.slice(2)}`;
  if (v.startsWith("0")) return `+62${v.slice(1)}`;
  if (v.startsWith("62")) return `+${v}`;
  if (v.startsWith("8")) return `+62${v}`;
  return `+${v}`;
}

export function validateEmail(email) {
  const v = (email || "").trim();
  if (!v) return "Email wajib diisi";
  if (!EMAIL_RE.test(v)) return "Format email tidak valid";
  return null;
}

export function validatePhone(phone) {
  const v = (phone || "").trim();
  if (!v) return "Nomor WhatsApp wajib diisi";
  if (!PHONE_E164_RE.test(normalizePhone(v))) return "Nomor WhatsApp tidak valid (contoh: 0812 3456 7890)";
  return null;
}

/** channel: "email" | "whatsapp" */
export const normalizeIdentifier = (channel, value) => (channel === "email" ? normalizeEmail(value) : normalizePhone(value));
export const validateIdentifier = (channel, value) => (channel === "email" ? validateEmail(value) : validatePhone(value));

/** Identifier login boleh email atau nomor WA — ditebak dari ada/tidaknya "@". */
export const channelOf = (identifier) => ((identifier || "").includes("@") ? "email" : "whatsapp");

export function unmetPasswordRules(password) {
  return PASSWORD_RULES.filter((r) => !r.test(password || ""));
}

// Pesan untuk password yang belum memenuhi syarat — menyebut syarat yang
// kurang saja (checklist di bawah field menunjukkan rinciannya).
export function validateNewPassword(password) {
  if (!password) return "Password wajib diisi";
  if (password.length > PASSWORD_MAX) return `Password maksimal ${PASSWORD_MAX} karakter`;
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
// backend (pesan gagalnya sengaja umum).
export function validateLogin({ identifier, password }) {
  const errors = {};
  const v = (identifier || "").trim();
  if (!v) errors.identifier = "Email atau nomor WhatsApp wajib diisi";
  else {
    const e = channelOf(v) === "email" ? validateEmail(v) : validatePhone(v);
    if (e) errors.identifier = e;
  }
  if (!password) errors.password = "Password wajib diisi";
  return errors;
}

function validateConfirm(password, confirm) {
  if (!confirm) return "Konfirmasi password wajib diisi";
  if (confirm !== password) return "Password tidak cocok";
  return null;
}

/**
 * Form data akun (langkah setelah kontak terverifikasi).
 * type: "umkm" | "mahasiswa". `nameLabel` mis. "Nama usaha" / "Nama lengkap".
 */
export function validateRegister(values, { type, nameLabel = "Nama" } = {}) {
  const { name, password, confirm, agree, university, universityCustom, campusEmail } = values;
  const errors = {};
  const n = (name || "").trim();
  if (!n) errors.name = `${nameLabel} wajib diisi`;
  else if (n.length < 2) errors.name = `${nameLabel} minimal 2 karakter`;
  else if (n.length > NAME_MAX) errors.name = `${nameLabel} maksimal ${NAME_MAX} karakter`;
  if (type === "mahasiswa") {
    const custom = university === UNIVERSITY_CUSTOM;
    if (!university) errors.university = "Pilih universitas";
    else if (custom) {
      const u = (universityCustom || "").replace(/\s+/g, " ").trim();
      if (!u) errors.universityCustom = "Nama universitas wajib diisi";
      else if (u.length > UNIVERSITY_CUSTOM_MAX) errors.universityCustom = `Nama universitas maksimal ${UNIVERSITY_CUSTOM_MAX} karakter`;
    }
    // Universitas di luar daftar tidak memakai email kampus (verifikasi lewat KTM).
    if (!custom && (campusEmail || "").trim()) {
      const e = validateEmail(campusEmail);
      if (e) errors.campusEmail = e.replace("Email", "Email kampus");
    }
  }
  const p = validateNewPassword(password);
  if (p) errors.password = p;
  const c = validateConfirm(password, confirm);
  if (c) errors.confirm = c;
  if (!agree) errors.agree = "Kamu perlu menyetujui Syarat & Ketentuan dan Kebijakan Privasi";
  return errors;
}

export function validateResetPassword({ password, confirm }) {
  const errors = {};
  const p = validateNewPassword(password);
  if (p) errors.password = p;
  const c = validateConfirm(password, confirm);
  if (c) errors.confirm = c;
  return errors;
}

// Sama dengan backend (VerificationController@uploadKtm): mimes:pdf,jpg,jpeg,png, max:5120 KB.
export const KTM_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
export const KTM_MAX_BYTES = 5120 * 1024;

export function validateKtmFile(file) {
  if (!file) return "Pilih file KTM";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!KTM_EXTENSIONS.includes(ext)) return "File KTM harus berformat PDF, JPG, atau PNG";
  if (file.size === 0) return "File KTM kosong";
  if (file.size > KTM_MAX_BYTES) return "Ukuran file KTM maksimal 5 MB";
  return null;
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

/** Tampilan identifier yang mudah dibaca: +6281234567890 → +62 812-3456-7890. */
export function displayIdentifier(channel, identifier) {
  if (channel !== "whatsapp" || !identifier?.startsWith("+62")) return identifier || "";
  const rest = identifier.slice(3);
  return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`.replace(/-$/, "");
}
