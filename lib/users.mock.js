// User "yang sedang login" per role (dummy, belum ada Supabase Auth) +
// daftar seluruh pengguna platform buat halaman Verify & Trust (verifikasi,
// riwayat pengguna). Nama dijaga konsisten dengan yang sudah dipakai di
// tempat lain: STUDENTS (lib/mock-data.js), kontak di lib/messages.mock.js,
// dan client di lib/projects.mock.js.

// name/plan/avatarBg dipertahankan SAMA PERSIS dengan CURRENT_USER_MAHA /
// CURRENT_USER_UMKM lama (lib/mock-data.js) supaya tidak ada regresi visual
// di sidebar/avatar. Field tambahan (university/business/adminId/
// accessLevel) dipakai profileFields di config/roles.js.
// `contact` dipakai halaman Pengaturan (components/settings/ContactPanel.js)
// — User ID, email (ditampilkan tersensor lewat maskEmail()), zona waktu,
// alamat, dan telepon. Satu sumber, bukan ditulis ulang di tiap panel.
export const CURRENT_USERS = {
  mahasiswa: {
    name: "Nadia Putri", plan: "Graphic Designer", avatarBg: "#EADFF0",
    university: "Universitas Indonesia",
    contact: {
      userId: "USR-10293", email: "nadia.putri@gmail.com",
      timezone: "UTC+07:00 Jakarta", address: "Jl. Margonda Raya, Depok, Jawa Barat",
      phone: "+62 812 3456 7890",
    },
  },
  umkm: {
    // Nama usaha tetap jadi identitas utama (dipakai di sidebar & sapaan
    // dashboard), pemilik aslinya (kontak yang sama dengan percakapan Pesan
    // mp1 — lihat lib/messages.mock.js) ditaruh di `plan`.
    name: "Kopi Anteng", plan: "Pemilik: Ratna Sulistiowati", avatarBg: "#DDEDE3",
    business: "Kopi & Minuman",
    contact: {
      userId: "USR-10057", email: "ratna.sulistiowati@kopianteng.id",
      timezone: "UTC+07:00 Jakarta", address: "Jl. Fatmawati No. 24, Jakarta Selatan",
      phone: "+62 813 9900 1122",
    },
    // Dipakai UmkmInfoPanel (Pengaturan > Info Saya). npwp sengaja null
    // supaya link "Masukkan NPWP…" tampil; logo/avatar null = placeholder.
    businessInfo: {
      accountType: "Dasar", owner: "Ratna Sulistiowati", size: "2-9 orang",
      npwp: null, logo: null, avatar: null,
    },
  },
  trust: {
    name: "Rizky Pratama", plan: "Trust & Safety Team", avatarBg: "#F5E5D9",
    adminId: "VT-0142", accessLevel: "Senior",
    // Dipakai TrustInfoPanel (Profil/Pengaturan > Info Saya, Verify & Trust).
    staffInfo: {
      department: "Trust & Safety",
      supervisor: "Maya Kusuma (Head of Trust & Safety)",
      shift: "Senin–Jumat · 09.00–17.00 WIB",
    },
    contact: {
      userId: "USR-00042", email: "rizky.pratama@digitalin.id",
      timezone: "UTC+07:00 Jakarta", address: "Kantor Digital.in, Jakarta Pusat",
      phone: "+62 811 2233 4455",
    },
  },
};

// Staf Verify & Trust. `id` = ID Admin (CURRENT_USERS.trust.adminId) — dipakai
// log aktivitas (lib/activity-log.js), statistik profil, dan penanda
// "siapa yang menyentuh" di baris transaksi/laporan.
export const ADMINS = {
  "VT-0142": { id: "VT-0142", name: "Rizky Pratama", level: "Senior" },
  "VT-0087": { id: "VT-0087", name: "Sari Dewanti", level: "Senior" },
};

// Dipakai halaman Verify & Trust (/verifications, /users). Campuran
// mahasiswa (dari STUDENTS) dan UMKM (dari client proyek yang sudah ada),
// beberapa berstatus "pending" biar ada yang perlu diverifikasi.
export const PLATFORM_USERS = [
  { id: "u-s2", name: "Rangga Saputra", type: "mahasiswa", university: "Institut Teknologi Bandung", joinedAt: "2026-09-10", verification: "pending" },
  { id: "u-s5", name: "Kirana Ayu", type: "mahasiswa", university: "Telkom University", joinedAt: "2026-09-12", verification: "pending" },
  { id: "u-s6", name: "Bagas Wirawan", type: "mahasiswa", university: "Universitas Diponegoro", joinedAt: "2026-09-13", verification: "pending" },
  { id: "u-c1", name: "Berkah Furniture", type: "umkm", business: "Furniture & Interior", joinedAt: "2026-09-11", verification: "pending" },
  { id: "u-c2", name: "Kedai Seduh Nusantara", type: "umkm", business: "Kafe & Minuman", joinedAt: "2026-09-14", verification: "pending" },

  // "belum" (belum mengajukan) — beda dari "pending" (sudah mengajukan,
  // menunggu ditinjau Verify & Trust): Nadia belum pernah mengirim dokumen
  // verifikasi, sesuai ajakan "Ajukan Verifikasi" yang sudah lama tampil di
  // ProfileSidePanel dashboard-nya. Nilai ini SENGAJA tidak ikut daftar
  // pending di /verifications (yang cuma baca verification==="pending").
  { id: "u-s1", name: "Nadia Putri", type: "mahasiswa", university: "Universitas Indonesia", joinedAt: "2026-03-02", verification: "belum" },
  // Akun terverifikasi: `verifiedBy` (ID Admin) + `verifiedAt` dipakai
  // lib/activity-log.js untuk menurunkan riwayat keputusan verifikasi, dan
  // lib/trust-stats.js untuk waktu respons (joinedAt -> verifiedAt).
  { id: "u-s3", name: "Dewi Lestari", type: "mahasiswa", university: "Universitas Gadjah Mada", joinedAt: "2026-04-18", verification: "terverifikasi", verifiedBy: "VT-0087", verifiedAt: "2026-04-19" },
  { id: "u-s4", name: "Farhan Maulana", type: "mahasiswa", university: "Universitas Bina Nusantara", joinedAt: "2026-02-20", verification: "terverifikasi", verifiedBy: "VT-0142", verifiedAt: "2026-02-22" },
  { id: "u-c3", name: "Kopi Anteng", type: "umkm", business: "Kopi & Minuman", joinedAt: "2026-01-15", verification: "terverifikasi", verifiedBy: "VT-0142", verifiedAt: "2026-01-16" },
  { id: "u-c4", name: "Batik Asri Nusantara", type: "umkm", business: "Fesyen & Kerajinan", joinedAt: "2026-02-01", verification: "terverifikasi", verifiedBy: "VT-0087", verifiedAt: "2026-02-02" },
];

// Dokumen dummy yang "diunggah" tiap user pending — dipakai kartu verifikasi
// di /verifications. Mahasiswa: KTP/KTM + NIM & kampus. UMKM: NIB + dokumen usaha.
export const VERIFICATION_DOCS = {
  "u-s2": [{ label: "KTM", file: "ktm-rangga-saputra.jpg" }, { label: "NIM & Kampus", value: "10121001 — Institut Teknologi Bandung" }],
  "u-s5": [{ label: "KTP", file: "ktp-kirana-ayu.jpg" }, { label: "NIM & Kampus", value: "1301210045 — Telkom University" }],
  "u-s6": [{ label: "KTM", file: "ktm-bagas-wirawan.jpg" }, { label: "NIM & Kampus", value: "24010120140098 — Universitas Diponegoro" }],
  "u-c1": [{ label: "NIB", file: "nib-berkah-furniture.pdf" }, { label: "Dokumen Usaha", file: "surat-izin-usaha.pdf" }],
  "u-c2": [{ label: "NIB", file: "nib-kedai-seduh.pdf" }, { label: "Dokumen Usaha", file: "foto-tempat-usaha.jpg" }],
};
