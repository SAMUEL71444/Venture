// BACKEND TIRUAN (mock) — hanya aktif bila NEXT_PUBLIC_AUTH_MOCK=true.
// Meniru kontrak backend Laravel (OTP sebelum daftar, email ATAU WhatsApp,
// lupa password 3 langkah) supaya UI bisa didemokan tanpa server.
// Fungsi di sini mengembalikan data berbentuk sama dengan backend asli dan
// melempar AuthFlowError untuk kegagalan. Dipanggil HANYA lewat lib/auth/api.js.
//
// Data akun di localStorage, "kotak masuk" OTP di sessionStorage (readDemoOutbox).
import { AuthFlowError } from "./errors";
import { OTP_LENGTH } from "./validation";
import { CURRENT_USERS } from "@/lib/users.mock";

const DB_KEY = "digitalin.mockAuth.v2";
const OUTBOX_KEY = "digitalin.mockAuth.outbox.v2";

const POLICY = {
  loginMaxAttempts: 5,
  loginLockSeconds: 60,
  otpTtlSeconds: 5 * 60,
  otpResendSeconds: 60,
  otpMaxAttempts: 5,
  registerTokenSeconds: 5 * 60,
  resetTokenSeconds: 15 * 60,
};

const DEMO_PASSWORD = "Digitalin123";
const LATENCY_MS = 500;

const SEED = [
  { role: "UMKM", name: CURRENT_USERS.umkm.name, email: CURRENT_USERS.umkm.contact.email, phone: "+6281234567890" },
  { role: "STUDENT", name: CURRENT_USERS.mahasiswa.name, email: CURRENT_USERS.mahasiswa.contact.email, phone: null },
  { role: "ADMIN", name: CURRENT_USERS.trust.name, email: CURRENT_USERS.trust.contact.email, phone: null },
];

export const DEMO_ACCOUNTS = SEED.map((s) => ({ role: s.role, identifier: s.email, password: DEMO_PASSWORD }));

const UNIVERSITIES = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Universitas Contoh Bandung", email_domain: "student.contoh.ac.id" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Institut Contoh Jakarta", email_domain: "mhs.contoh.ac.id" },
];

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

// PBKDF2 lewat Web Crypto (secure context). Di luar itu: hash iteratif demo.
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
  return { users: [], otps: {}, loginAttempts: {} };
}

function writeDb(d) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch { /* sesi ini saja */ }
}

let seeding = null;
async function db() {
  const d = readDb();
  if (d.users.length) return d;
  seeding = seeding || (async () => {
    const fresh = readDb();
    for (const s of SEED) {
      const salt = randomHex();
      fresh.users.push({ id: randomHex(8), ...s, status: "ACTIVE", salt, hash: await hashSecret(DEMO_PASSWORD, salt) });
    }
    writeDb(fresh);
  })();
  await seeding;
  seeding = null;
  return readDb();
}

async function network() {
  await sleep(LATENCY_MS);
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new AuthFlowError("NETWORK");
}

const column = (channel) => (channel === "email" ? "email" : "phone");
const findUser = (d, channel, identifier) => d.users.find((u) => u[column(channel)] === identifier);
const otpKey = (purpose, channel, identifier) => `${purpose}:${channel}:${identifier}`;
const summary = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, status: u.status });
const tokens = () => ({ token_type: "Bearer", access_token: `mock.${randomHex()}`, refresh_token: `mock.${randomHex(48)}` });

function deliver(channel, identifier, code) {
  try {
    const outbox = JSON.parse(sessionStorage.getItem(OUTBOX_KEY) || "{}");
    outbox[`${channel}:${identifier}`] = { code, sentAt: now() };
    sessionStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch { /* abaikan */ }
}

export function readDemoOutbox(channel, identifier) {
  try {
    return JSON.parse(sessionStorage.getItem(OUTBOX_KEY) || "{}")[`${channel}:${identifier}`] || null;
  } catch {
    return null;
  }
}

// --- "endpoint" -----------------------------------------------------------------
export async function sendOtp({ purpose, channel, identifier }) {
  await network();
  const d = await db();
  const user = findUser(d, channel, identifier);
  const key = otpKey(purpose, channel, identifier);
  const prev = d.otps[key];
  const generic = { expiresAt: now() + POLICY.otpTtlSeconds * 1000, resendAfter: POLICY.otpResendSeconds };

  if (purpose === "register" && user) throw new AuthFlowError("IDENTIFIER_TAKEN");
  if (prev && prev.resendAt > now()) {
    if (purpose === "reset") return generic; // respons tetap sama (anti-enumerasi)
    throw new AuthFlowError("OTP_COOLDOWN", { retryAfter: secondsUntil(prev.resendAt) });
  }
  if (purpose === "reset" && (!user || user.status === "SUSPENDED")) return generic;

  const code = randomOtp();
  const salt = randomHex(8);
  d.otps[key] = { salt, hash: await hashSecret(code, salt), expiresAt: generic.expiresAt, resendAt: now() + POLICY.otpResendSeconds * 1000, attempts: 0 };
  writeDb(d);
  deliver(channel, identifier, code);
  return generic;
}

export async function verifyOtp({ purpose, channel, identifier, code }) {
  await network();
  const d = await db();
  const o = d.otps[otpKey(purpose, channel, identifier)];
  const isReset = purpose === "reset";

  if (!o?.hash || o.expiresAt <= now()) throw new AuthFlowError(isReset ? "OTP_INVALID_OR_EXPIRED" : "OTP_EXPIRED");
  if ((await hashSecret(code, o.salt)) !== o.hash) {
    o.attempts += 1;
    const left = POLICY.otpMaxAttempts - o.attempts;
    if (left <= 0) o.hash = null;
    writeDb(d);
    if (isReset) throw new AuthFlowError("OTP_INVALID_OR_EXPIRED");
    throw left <= 0 ? new AuthFlowError("OTP_LOCKED") : new AuthFlowError("OTP_INVALID", { attemptsLeft: left });
  }

  const token = randomHex(32);
  const ttl = isReset ? POLICY.resetTokenSeconds : POLICY.registerTokenSeconds;
  Object.assign(o, { hash: null, token, tokenExpiresAt: now() + ttl * 1000 });
  writeDb(d);
  return { token, expiresIn: ttl };
}

function consume(d, purpose, channel, identifier, token) {
  const o = d.otps[otpKey(purpose, channel, identifier)];
  if (!o?.token || o.token !== token || o.tokenExpiresAt <= now()) {
    throw new AuthFlowError(purpose === "reset" ? "RESET_EXPIRED" : "VERIFICATION_EXPIRED");
  }
  o.token = null;
}

export async function register({ type, channel, identifier, token, values }) {
  await network();
  const d = await db();
  if (findUser(d, channel, identifier)) throw new AuthFlowError("IDENTIFIER_TAKEN");
  consume(d, "register", channel, identifier, token);

  const salt = randomHex();
  const user = {
    id: randomHex(8),
    name: values.name.trim(),
    email: channel === "email" ? identifier : null,
    phone: channel === "whatsapp" ? identifier : null,
    role: type === "umkm" ? "UMKM" : "STUDENT",
    status: type === "umkm" ? "ACTIVE" : "PENDING_VERIFICATION",
    salt,
    hash: await hashSecret(values.password, salt),
  };
  d.users.push(user);
  writeDb(d);
  return { user: summary(user), tokens: tokens() };
}

export async function login({ identifier, password }) {
  await network();
  const d = await db();
  const key = identifier.toLowerCase();
  const att = d.loginAttempts[key] || { fails: 0, lockedUntil: 0 };
  if (att.lockedUntil > now()) throw new AuthFlowError("LOCKED", { retryAfter: secondsUntil(att.lockedUntil) });

  const user = d.users.find((u) => u.email === key || u.phone === identifier);
  const match = !!user && (await hashSecret(password, user.salt)) === user.hash && user.status !== "SUSPENDED";
  if (!match) {
    att.fails += 1;
    if (att.fails >= POLICY.loginMaxAttempts) Object.assign(att, { fails: 0, lockedUntil: now() + POLICY.loginLockSeconds * 1000 });
    d.loginAttempts[key] = att;
    writeDb(d);
    throw att.lockedUntil > now()
      ? new AuthFlowError("LOCKED", { retryAfter: POLICY.loginLockSeconds })
      : new AuthFlowError("INVALID_CREDENTIALS");
  }
  delete d.loginAttempts[key];
  writeDb(d);
  return { user: summary(user), tokens: tokens() };
}

export async function logout() {
  await sleep(150);
}

export async function resetPassword({ channel, identifier, token, password }) {
  await network();
  const d = await db();
  consume(d, "reset", channel, identifier, token);
  const user = findUser(d, channel, identifier);
  if (!user) throw new AuthFlowError("RESET_EXPIRED");
  if (user.status === "SUSPENDED") {
    writeDb(d);
    throw new AuthFlowError("ACCOUNT_SUSPENDED");
  }
  user.salt = randomHex();
  user.hash = await hashSecret(password, user.salt);
  writeDb(d);
  return true;
}

export async function universities() {
  await sleep(200);
  return UNIVERSITIES;
}
