// Klien HTTP ke backend Laravel (Sanctum, token Bearer + refresh token).
// - Setiap request membawa `Authorization: Bearer <access token>` dari memori.
// - Respons 401 → refresh SEKALI (single-flight); request lain yang ikut 401
//   selama refresh berjalan diantrikan lalu diulang dengan token baru.
// - parseApiError() menyeragamkan error ke { status, code, message, details, retryAfter }
//   dari format backend { error: { code, message, details } } + header Retry-After.
import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearSession, markAccountPending } from "./auth/session";

// Wajib diisi lewat env (lokal: .env.local; Vercel: Project Settings → Environment Variables).
// Tidak ada fallback localhost; build di Vercel gagal bila kosong (lihat next.config.mjs).
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
if (!API_URL && typeof window !== "undefined") {
  console.error("NEXT_PUBLIC_API_URL belum diisi — request ke backend akan gagal.");
}

const BASE_CONFIG = { baseURL: API_URL, timeout: 15000, headers: { Accept: "application/json" } };

export const api = axios.create(BASE_CONFIG);
// Klien terpisah tanpa interceptor untuk memanggil /auth/refresh.
const bare = axios.create(BASE_CONFIG);

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 dari endpoint ini berarti kredensial/OTP salah, bukan token kedaluwarsa.
const NO_REFRESH = ["/auth/login", "/auth/refresh", "/auth/register", "/auth/otp", "/auth/password"];

let refreshing = false;
let waiting = []; // antrean { resolve, reject } selama refresh berjalan

function flush(error, token) {
  waiting.forEach((w) => (error ? w.reject(error) : w.resolve(token)));
  waiting = [];
}

/** Tukar refresh token dengan pasangan token baru. Satu refresh untuk banyak pemanggil. */
export function refreshSession() {
  return new Promise((resolve, reject) => {
    waiting.push({ resolve, reject });
    if (refreshing) return;

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      flush(new Error("NO_REFRESH_TOKEN"));
      return;
    }

    refreshing = true;
    bare.post("/auth/refresh", { refresh_token: refreshToken })
      .then((res) => {
        setTokens(res.data.data);
        flush(null, res.data.data.access_token);
      })
      .catch((err) => {
        // 401 = refresh token tidak sah/kedaluwarsa/dicabut → sesi berakhir.
        // Galat jaringan tidak menghapus sesi supaya bisa dicoba lagi.
        if (err.response?.status === 401) clearSession("expired");
        flush(err);
      })
      .finally(() => {
        refreshing = false;
      });
  });
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    if (status === 403 && code === "ACCOUNT_SUSPENDED") {
      clearSession("suspended");
      return Promise.reject(error);
    }

    // Akun belum terverifikasi memanggil endpoint yang tidak diizinkan: sesi tetap,
    // tetapi status user diperbarui supaya halaman menampilkan banner/arahan ke /verify.
    if (status === 403 && code === "ACCOUNT_PENDING_VERIFICATION") {
      markAccountPending();
      return Promise.reject(error);
    }

    const canRefresh = status === 401
      && original
      && !original._retried
      && !NO_REFRESH.some((path) => (original.url || "").startsWith(path))
      && getRefreshToken();
    if (!canRefresh) return Promise.reject(error);

    original._retried = true;
    try {
      const token = await refreshSession();
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    } catch {
      return Promise.reject(error);
    }
  },
);

/** Error axios → { status, code, message, details, retryAfter }. status 0 = jaringan/server mati. */
export function parseApiError(error) {
  const response = error?.response;
  if (!response) {
    return { status: 0, code: "NETWORK", message: error?.message || "Network error", details: null, retryAfter: null };
  }
  const body = response.data?.error || {};
  const header = Number(response.headers?.["retry-after"]);
  const detail = Number(body.details?.retry_after ?? body.details?.retry_after_seconds);
  const retryAfter = header > 0 ? header : detail > 0 ? detail : null;
  return {
    status: response.status,
    code: body.code || `HTTP_${response.status}`,
    message: body.message || "",
    details: body.details ?? null,
    retryAfter,
  };
}
