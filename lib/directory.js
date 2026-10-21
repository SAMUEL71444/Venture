// Direktori ID pihak — satu tempat untuk mengubah NAMA menjadi ID yang stabil,
// supaya transaksi, proyek, laporan, dan log aksi saling merujuk lewat ID
// (bukan string nama yang diketik ulang di tiap tempat).
//
//   Mahasiswa : u-<freelancerId>   (u-s1 = Nadia Putri) — sama dengan PLATFORM_USERS
//   UMKM      : id dari PLATFORM_USERS bila terdaftar (Kopi Anteng = u-c3),
//               selain itu ID tetap hasil slug nama (klien proyek Nadia yang
//               belum ada di daftar verifikasi, mis. "Warung Ibu Sari").
//   Admin     : ID Admin (VT-xxxx), lihat ADMINS di lib/users.mock.js.
import { PLATFORM_USERS, ADMINS } from "./users.mock";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function mahasiswaIdOf(freelancerId) {
  return freelancerId ? `u-${freelancerId}` : null;
}

// type: "mahasiswa" | "umkm". Untuk mahasiswa dicari lewat nama di
// PLATFORM_USERS dulu (data pengguna), baru jatuh ke slug.
export function userIdFor(type, name) {
  if (!name) return null;
  const known = PLATFORM_USERS.find((u) => u.type === type && u.name === name);
  if (known) return known.id;
  return `u-${type === "umkm" ? "c" : "s"}-${slug(name)}`;
}

export function adminName(adminId) {
  return ADMINS[adminId]?.name || adminId;
}
