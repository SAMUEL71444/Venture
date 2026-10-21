// Pengaman deploy: di Vercel, URL backend wajib ada dan bukan localhost
// (kalau tidak, aplikasi ter-deploy diam-diam memanggil server yang salah).
if (process.env.VERCEL === "1") {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  if (!apiUrl || /localhost|127\.0\.0\.1/.test(apiUrl)) {
    throw new Error("NEXT_PUBLIC_API_URL wajib diisi dengan URL backend publik (mis. https://<service>.onrender.com/api/v1).");
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
};

export default nextConfig;
