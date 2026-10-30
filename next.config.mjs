// Mode demo laptop (lihat DEPLOY.md "Mode demo laptop" dan demo-start.ps1): Next.js meneruskan
// /api/* ke Laravel lokal, sehingga cukup satu tunnel (ke port 3000) dan frontend memakai
// NEXT_PUBLIC_API_URL=/api/v1. Mati secara default; deploy normal tidak terpengaruh.
const DEMO_LOCAL_PROXY = process.env.DEMO_LOCAL_PROXY === "true";
const DEMO_BACKEND_ORIGIN = "http://127.0.0.1:8000";

// Pengaman deploy: di Vercel, URL backend wajib ada, absolut, dan bukan localhost
// (kalau tidak, aplikasi ter-deploy diam-diam memanggil server yang salah).
if (process.env.VERCEL === "1") {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  if (!/^https?:\/\//.test(apiUrl) || /localhost|127\.0\.0\.1/.test(apiUrl)) {
    throw new Error("NEXT_PUBLIC_API_URL wajib diisi dengan URL backend publik (mis. https://<service>.onrender.com/api/v1).");
  }
  if (DEMO_LOCAL_PROXY) {
    throw new Error("DEMO_LOCAL_PROXY hanya untuk demo di laptop; jangan di-set di Vercel.");
  }
  if (process.env.NEXT_PUBLIC_AUTH_MOCK === "true") {
    console.warn("PERINGATAN: NEXT_PUBLIC_AUTH_MOCK=true — login memakai backend tiruan di browser. Jangan dipakai untuk pengguna sungguhan.");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Verifikasi otomatis (build/dev server terpisah buat ambil screenshot)
  // sengaja diarahkan ke NEXT_DIST_DIR lain lewat env var ini, supaya nggak
  // pernah nimpa .next yang lagi dipakai dev server utama kamu. Itu
  // penyebab error "Cannot find module './xxx.js'" kemarin.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // URL lama (sebelum refaktor role-based routing) diarahkan ke URL bersama
  // yang baru, supaya link/bookmark lama nggak mati. Lihat config/roles.js
  // dan app/dashboard, app/projects, app/earnings buat rute barunya.
  async redirects() {
    return [
      { source: "/mahasiswa/dashboard", destination: "/dashboard", permanent: false },
      { source: "/mahasiswa/projects", destination: "/projects", permanent: false },
      { source: "/mahasiswa/earnings", destination: "/earnings", permanent: false },
      { source: "/umkm/dashboard", destination: "/dashboard", permanent: false },
    ];
  },

  // Hanya mode demo laptop. Dibaca saat `next build`, jadi DEMO_LOCAL_PROXY harus di-set saat build.
  // Header X-Forwarded-For / CF-Connecting-IP dari Cloudflare diteruskan apa adanya ke Laravel.
  async rewrites() {
    if (!DEMO_LOCAL_PROXY) return [];
    return [{ source: "/api/:path*", destination: `${DEMO_BACKEND_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
