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
