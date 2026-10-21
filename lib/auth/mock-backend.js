// BACKEND SEMENTARA (mock) — menyimulasikan server auth di browser sampai
// backend asli digabungkan. Hanya dipanggil lewat lib/auth/api.js; saat
// integrasi, file ini boleh dihapus seluruhnya.
//
// Yang disimulasikan, supaya semua skenario bisa dites dari UI:
// - validasi ulang di "server" dengan aturan yang sama (lib/auth/validation.js)
// - password & OTP disimpan sebagai HASH (PBKDF2-SHA256 + salt), bukan teks biasa
// - kunci login setelah 5x gagal, OTP kedaluwarsa 10 menit, kirim ulang 60
//   detik, blokir OTP setelah 5x salah
// Data akun di localStorage (bertahan saat refresh), "kotak masuk email" OTP
// di sessionStorage (lihat readDemoOutbox) karena belum ada layanan email.
import {
  normalizeEmail, validateLogin, validateRegister, validateOtp, OTP_LENGTH,
} from "./validation";
import { CURRENT_USERS } from "@/lib/users.mock";

const DB_KEY = "digitalin.mockAuth.v1";
const OUTBOX_KEY = "digitalin.mockAuth.outbox";

export const POLICY = {
  loginMaxAttempts: 5,
  loginLockSeconds: 30,
  otpTtlSeconds: 10 * 60,
  otpResendSeconds: 60,
  otpMaxAttempts: 5,
  otpLockSeconds: 5 * 60,
};

const DEMO_PASSWORD = "Digitalin123";
const LATENCY_MS = 650;

// Akun contoh (sudah terverifikasi) per role + satu akun belum terverifikasi
// untuk menguji pesan "Akun belum diverifikasi".
const SEED = [
  { role: "umkm", name: CURRENT_USERS.umkm.name, email: CURRENT_USERS.umkm.contact.email, verified: true },
  { role: "mahasiswa", name: CURRENT_USERS.mahasiswa.name, email: CURRENT_USERS.mahasiswa.contact.email, verified: true },
  { role: "trust", name: CURRENT_USERS.trust.name, email: CURRENT_USERS.trust.contact.email, verified: true },
  { role: "mahasiswa", name: "Akun Belum Verifikasi", email: "belum.verifikasi@digitalin.id", verified: false },
];

export const DEMO_ACCOUNTS = Object.fromEntries(
  SEED.filter((s) => s.verified).map((s) => [s.role, { email: s.email, password: DEMO_PASSWORD }])
);
export const UNVERIFIED_DEMO = { email: SEED[3].email, password: DEMO_PASSWORD };

// --- util -------------------------------------------------------------------
const now = () => Date.now();
const secondsUntil = (t) => Math.max(0, Math.ceil((t - now()) / 1000));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function randomHex(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomOtp() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 10 ** OTP_LENGTH).padStart(OTP_LENGTH, "0");
}

// PBKDF2 lewat Web Crypto. crypto.subtle hanya ada di secure context
// (https / localhost) — kalau dibuka via IP LAN tanpa https, jatuh ke hash
// iteratif sederhana (KHUSUS demo; tetap bukan teks biasa).
async function hashSecret(secret, salt) {
  if (globalThis.crypto?.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: 100000 }, key, 256);
    return "pbkdf2$" + [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 0x811c9dc5;
  const s = `${salt}:${secret}`;
  for (let round = 0; round < 5000; round++) {
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) + round; h = Math.imul(h, 0x01000193) >>> 0; }
  }
  return "fnv$" + h.toString(16);
}

function readDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage diblokir/korup — mulai dari kosong */ }
  return { users: {}, otps: {}, loginAttempts: {} };
}

function writeDb(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* sesi ini saja */ }
}

let seeding = null;
async function db() {
  const d = readDb();
  if (SEED.every((s) => d.users[normalizeEmail(s.email)])) return d;
  // Sekali saja: buat akun contoh (hash password butuh async).
  seeding = seeding || (async () => {
    const fresh = readDb();
    for (const s of SEED) {
      const email = normalizeEmail(s.email);
      if (fresh.users[email]) continue;
      const salt = randomHex();
      fresh.users[email] = { email, name: s.name, role: s.role, salt, hash: await hashSecret(DEMO_PASSWORD, salt), verified: s.verified, createdAt: now() };
    }
    writeDb(fresh);
  })();
  await seeding;
  seeding = null;
  return readDb();
}

// Simulasi fetch: jeda jaringan + gagal seperti fetch() kalau offline.
async function network() {
  await sleep(LATENCY_MS);
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new TypeError("Failed to fetch");
}

const fail = (code, extra = {}) => ({ ok: false, error: { code, ...extra } });
const publicUser = (u) => ({ name: u.name, email: u.email, role: u.role, verified: u.verified });

// "Kirim email": simpan hash OTP di server, kode asli ke kotak masuk demo.
async function issueOtp(d, email) {
  const code = randomOtp();
  const salt = randomHex(8);
  d.otps[email] = {
    salt, hash: await hashSecret(code, salt),
    expiresAt: now() + POLICY.otpTtlSeconds * 1000,
    resendAt: now() + POLICY.otpResendSeconds * 1000,
    attempts: 0, lockedUntil: 0,
  };
  try {
    const outbox = JSON.parse(sessionStorage.getItem(OUTBOX_KEY) || "{}");
    outbox[email] = { code, sentAt: now() };
    sessionStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch { /* abaikan */ }
}

export function readDemoOutbox(email) {
  try { return JSON.parse(sessionStorage.getItem(OUTBOX_KEY) || "{}")[normalizeEmail(email)] || null; } catch { return null; }
}

function otpStatus(d, email) {
  const o = d.otps[email];
  if (!o) return { resendIn: 0, lockedFor: 0, expiresIn: 0, attemptsLeft: POLICY.otpMaxAttempts, hasCode: false };
  return {
    resendIn: secondsUntil(o.resendAt),
    lockedFor: secondsUntil(o.lockedUntil),
    expiresIn: o.hash ? secondsUntil(o.expiresAt) : 0,
    attemptsLeft: POLICY.otpMaxAttempts - o.attempts,
    hasCode: !!o.hash,
  };
}

// --- "endpoint" -----------------------------------------------------------
export async function mockLogin({ email, password, role }) {
  await network();
  const errors = validateLogin({ email, password });
  if (Object.keys(errors).length) return fail("VALIDATION", { fields: errors });

  const d = await db();
  const key = normalizeEmail(email);
  const att = d.loginAttempts[key] || { fails: 0, lockedUntil: 0 };
  if (att.lockedUntil > now()) return fail("LOCKED", { retryAfter: secondsUntil(att.lockedUntil) });

  const user = d.users[key];
  const match = !!user && (await hashSecret(password, user.salt)) === user.hash;
  if (!match) {
    // Email tak terdaftar & password salah dihitung SAMA (tidak membocorkan
    // email mana yang terdaftar).
    att.fails += 1;
    if (att.fails >= POLICY.loginMaxAttempts) {
      att.fails = 0;
      att.lockedUntil = now() + POLICY.loginLockSeconds * 1000;
      d.loginAttempts[key] = att;
      writeDb(d);
      return fail("LOCKED", { retryAfter: POLICY.loginLockSeconds });
    }
    d.loginAttempts[key] = att;
    writeDb(d);
    return fail("INVALID_CREDENTIALS", { attemptsLeft: POLICY.loginMaxAttempts - att.fails });
  }

  delete d.loginAttempts[key];
  writeDb(d);
  // Info di bawah baru dibuka SETELAH password terbukti benar.
  if (!user.verified) return fail("UNVERIFIED", { email: user.email, role: user.role });
  if (role && user.role !== role) return fail("ROLE_MISMATCH", { role: user.role });
  return { ok: true, data: { user: publicUser(user) } };
}

export async function mockRegister({ name, email, password, confirm, agree, role, nameLabel }) {
  await network();
  const errors = validateRegister({ name, email, password, confirm, agree }, { nameLabel });
  if (!["umkm", "mahasiswa"].includes(role)) errors.role = "Jenis akun tidak valid";
  if (Object.keys(errors).length) return fail("VALIDATION", { fields: errors });

  const d = await db();
  const key = normalizeEmail(email);
  if (d.users[key]) return fail("EMAIL_TAKEN", { fields: { email: "Email sudah terdaftar, silakan login" } });

  const salt = randomHex();
  d.users[key] = { email: key, name: name.trim(), role, salt, hash: await hashSecret(password, salt), verified: false, createdAt: now() };
  await issueOtp(d, key);
  writeDb(d);
  return { ok: true, data: { email: key, role, ...otpStatus(d, key) } };
}

export async function mockVerificationStatus({ email }) {
  await network();
  const d = await db();
  const key = normalizeEmail(email);
  const user = d.users[key];
  if (!user) return fail("NOT_FOUND");
  return { ok: true, data: { email: key, role: user.role, verified: user.verified, ...otpStatus(d, key) } };
}

export async function mockResendOtp({ email }) {
  await network();
  const d = await db();
  const key = normalizeEmail(email);
  const user = d.users[key];
  if (!user) return fail("NOT_FOUND");
  if (user.verified) return fail("ALREADY_VERIFIED");
  const s = otpStatus(d, key);
  if (s.lockedFor > 0) return fail("OTP_LOCKED", { retryAfter: s.lockedFor });
  if (s.resendIn > 0) return fail("OTP_COOLDOWN", { retryAfter: s.resendIn });
  await issueOtp(d, key);
  writeDb(d);
  return { ok: true, data: otpStatus(d, key) };
}

export async function mockVerifyOtp({ email, code }) {
  await network();
  const v = validateOtp(code);
  if (v) return fail("VALIDATION", { fields: { code: v } });

  const d = await db();
  const key = normalizeEmail(email);
  const user = d.users[key];
  if (!user) return fail("NOT_FOUND");
  if (user.verified) return fail("ALREADY_VERIFIED");

  const o = d.otps[key];
  if (o?.lockedUntil > now()) return fail("OTP_LOCKED", { retryAfter: secondsUntil(o.lockedUntil) });
  if (!o?.hash || o.expiresAt <= now()) return fail("OTP_EXPIRED");

  if ((await hashSecret(code, o.salt)) !== o.hash) {
    o.attempts += 1;
    const left = POLICY.otpMaxAttempts - o.attempts;
    if (left <= 0) {
      // Blokir + kode lama hangus: setelah blokir selesai harus minta kode baru.
      Object.assign(o, { hash: null, attempts: 0, lockedUntil: now() + POLICY.otpLockSeconds * 1000, resendAt: 0 });
      writeDb(d);
      return fail("OTP_LOCKED", { retryAfter: POLICY.otpLockSeconds });
    }
    writeDb(d);
    return fail("OTP_INVALID", { attemptsLeft: left });
  }

  user.verified = true;
  delete d.otps[key];
  writeDb(d);
  return { ok: true, data: { user: publicUser(user) } };
}
