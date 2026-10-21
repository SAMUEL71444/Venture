// Status sementara alur daftar, di sessionStorage (hilang saat tab ditutup):
// 1. pending — OTP sudah dikirim ke { channel, identifier } (untuk countdown kirim ulang)
// 2. proof   — OTP benar; verification_token sekali pakai untuk POST register.
//    Token ini berumur pendek (sama dengan umur OTP di backend) dan tidak
//    pernah ditaruh di URL.
const PENDING_KEY = "digitalin.signup.pending";
const PROOF_KEY = "digitalin.signup.proof";

function read(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else sessionStorage.removeItem(key);
  } catch { /* storage diblokir: alur tetap jalan selama halaman tidak di-reload */ }
}

/** { type, channel, identifier, expiresAt, resendAt } */
export const savePending = (value) => write(PENDING_KEY, value);
export function readPending({ channel, identifier }) {
  const p = read(PENDING_KEY);
  return p && p.channel === channel && p.identifier === identifier ? p : null;
}

/** { type, channel, identifier, token, expiresAt } */
export const saveProof = (value) => write(PROOF_KEY, value);
export function readProof(type) {
  const p = read(PROOF_KEY);
  return p && p.type === type && p.expiresAt > Date.now() ? p : null;
}

export function clearSignup() {
  write(PENDING_KEY, null);
  write(PROOF_KEY, null);
}
