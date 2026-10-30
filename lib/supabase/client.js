// Klien Supabase untuk sisi browser (komponen "use client").
// Memakai anon key — AMAN dibawa ke browser karena akses data tetap
// dibatasi oleh Row Level Security (RLS) di database. Jangan pernah
// menaruh service_role key di sini.
//
// Env wajib (isi di .env.local lokal, dan di Vercel → Project Settings → Env):
//   NEXT_PUBLIC_SUPABASE_URL       = https://<project-ref>.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  = anon public key
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Tidak throw di import supaya build tidak langsung mati; komponen yang
  // memakai akan menampilkan error jelas saat dipanggil tanpa konfigurasi.
  if (typeof window !== "undefined") {
    console.error(
      "Supabase belum dikonfigurasi: isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}

// Satu instance dibagi ke seluruh aplikasi (hindari membuat banyak koneksi).
export const supabase = createClient(url || "http://invalid.local", anonKey || "anon-placeholder", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isSupabaseConfigured = Boolean(url && anonKey);
