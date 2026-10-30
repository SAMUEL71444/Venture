/** @type {import('next').NextConfig} */
// Versi Supabase: back end memakai Supabase (bukan Laravel), jadi tidak ada
// NEXT_PUBLIC_API_URL / proxy demo. Pengaman lama yang mewajibkan env itu di
// Vercel sudah dihapus karena tidak relevan lagi.
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Redirect URL lama (sebelum refaktor role-based routing) ke URL bersama.
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
