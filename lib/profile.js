// Logic kelengkapan profil freelancer — DIPAKAI BERSAMA oleh
// components/profile/CompletenessSidebar.js (halaman /profile) dan
// components/dashboard/ProfileSidePanel.js (widget sidebar dashboard),
// supaya persentase dan item yang "belum lengkap" selalu sama di kedua
// tempat, bukan dihitung dua kali dengan logic yang bisa menyimpang.

// Urutan di sini MENENTUKAN urutan checklist DAN item mana yang jadi
// `firstMissing` (dipakai link "Lengkapi profil" di dashboard untuk
// ?focus=<key>). `focusId` = id elemen yang di-scroll-ke di halaman Profil
// (lihat FreelancerProfile.js).
const COMPLETENESS_ITEMS = [
  { key: "video", label: "Video Perkenalan", focusId: "fp-item-video", check: (p) => !!p.videoIntro },
  { key: "hours", label: "Jam Tersedia per Minggu", focusId: "fp-item-hours", check: (p) => !!p.hoursPerWeek },
  { key: "languages", label: "Bahasa", focusId: "fp-item-languages", check: (p) => p.languages.length > 0 },
  { key: "verification", label: "Verifikasi", focusId: "fp-item-verification", check: (p, idVerified) => idVerified && p.studentCardVerified },
  { key: "certs", label: "Lisensi & Sertifikasi", focusId: "fp-section-certifications", check: (p) => p.licenses.length > 0 || p.certifications.length > 0 },
  { key: "education", label: "Pendidikan", focusId: "fp-item-education", check: (p) => p.education.length > 0 },
];

// { items: [{key,label,done,focusId}], pct, firstMissing: key|null }
export function getProfileCompleteness(profile, idVerified) {
  const items = COMPLETENESS_ITEMS.map((i) => ({ key: i.key, label: i.label, focusId: i.focusId, done: !!i.check(profile, idVerified) }));
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  const firstMissing = items.find((i) => !i.done)?.key || null;
  return { items, pct, firstMissing };
}

// Dipanggil cuma kalau profil sudah 100%. Cek berurutan — yang pertama
// belum terpenuhi jadi tip yang ditampilkan. Kalau semua terpenuhi,
// tampilkan pesan apresiasi.
export function getGrowthTip(profile) {
  if (profile.catalog.length === 0) {
    return { message: "Profilmu lengkap! Tambahkan Katalog Proyek untuk dapat lebih banyak klien.", href: "/profile?focus=catalog" };
  }
  if (!profile.assessmentDone) {
    return { message: "Profilmu lengkap! Ikuti asesmen gaya kerja supaya UMKM lebih mudah melihat kecocokanmu.", href: "/profile?focus=skills" };
  }
  if (profile.portfolio.published.length === 0) {
    return { message: "Profilmu lengkap! Publikasikan portofolio supaya lebih mudah ditemukan UMKM.", href: "/profile?focus=portfolio" };
  }
  if (profile.certifications.length === 0) {
    return { message: "Profilmu lengkap! Tambahkan sertifikasi untuk memperkuat bukti keahlianmu.", href: "/profile?focus=certifications" };
  }
  return { message: "Profilmu dalam kondisi terbaik. Terus perbarui portofolio agar tetap menarik.", href: "/profile" };
}
