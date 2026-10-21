// Data dummy khusus halaman "Proyek Saya" (mahasiswa) — dipisah dari
// lib/mock-data.js supaya gampang diganti query Supabase nanti tanpa
// nyenggol data dummy layar lain.

import { enrichProject } from "./progress";

// Ganti jadi `true` buat lihat tampilan kondisi kosong (belum ada proyek
// sama sekali) di ketiga tab, tanpa perlu ngosongin array di bawah manual.
export const USE_EMPTY_STATE = false;

// "Hari ini" versi data dummy — dipakai buat hitung sisa hari ke tenggat,
// supaya angkanya masuk akal terhadap tanggal di bawah. Ganti ke tanggal
// sungguhan begitu datanya dari Supabase.
export const MOCK_TODAY = "2026-09-15";

export const STATUS_META = {
  berjalan: { label: "Berjalan", badgeClass: "badge-info", icon: "activity" },
  menunggu_review: { label: "Menunggu Review", badgeClass: "badge-warning", icon: "clock" },
  revisi: { label: "Revisi", badgeClass: "badge-error", icon: "rotate" },
  selesai: { label: "Selesai", badgeClass: "badge-success", icon: "checkCircle" },
  dibatalkan: { label: "Dibatalkan", badgeClass: "badge-neutral", icon: "xCircle" },
  terbuka: { label: "Terbuka", badgeClass: "badge-primary", icon: "bookmark" },
};

const ACTIVE_STATUSES = ["berjalan", "menunggu_review", "revisi"];

// Tiap proyek cuma menyimpan data mentah: milestone, jumlah file yang
// diminta, dan log event. Progress, status milestone, file terkirim, tanggal
// "diperbarui", dan histori dihitung dari sini oleh lib/progress.js.
// Jenis event: mulai | upload | kirim | revisi | disetujui | batal.
const MY_PROJECTS = [
  {
    id: "mp1", title: "Desain Konten Instagram Bulanan", client: "Kopi Anteng", category: "Social Media", status: "berjalan",
    budget: 1500000, startDate: "2026-09-01", deadline: "2026-09-25",
    description: "12 desain feed dan 4 reels untuk promosi menu baru bulan ini. Sedang di tahap produksi batch kedua.",
    milestones: [
      { id: "m1", name: "Moodboard & kalender konten" },
      { id: "m2", name: "Batch 1: 6 desain feed" },
      { id: "m3", name: "Batch 2: 6 desain feed" },
      { id: "m4", name: "4 video reels menu baru" },
    ],
    deliverablesRequired: 6,
    events: [
      { date: "2026-09-01", type: "mulai", milestone: "m1" },
      { date: "2026-09-03", type: "upload", file: "moodboard-kopi-anteng.pdf" },
      { date: "2026-09-03", type: "upload", file: "kalender-konten-september.xlsx" },
      { date: "2026-09-03", type: "kirim", milestone: "m1" },
      { date: "2026-09-04", type: "disetujui", milestone: "m1" },
      { date: "2026-09-05", type: "mulai", milestone: "m2" },
      { date: "2026-09-08", type: "upload", file: "feed-batch-1.zip" },
      { date: "2026-09-08", type: "kirim", milestone: "m2" },
      { date: "2026-09-09", type: "disetujui", milestone: "m2" },
      { date: "2026-09-10", type: "mulai", milestone: "m3" },
      { date: "2026-09-14", type: "upload", file: "feed-batch-2-draft.zip" },
    ],
  },
  {
    id: "mp2", title: "Pembuatan Logo & Panduan Merek", client: "Batik Asri Nusantara", category: "Branding", status: "menunggu_review",
    budget: 2000000, startDate: "2026-08-25", deadline: "2026-09-30",
    description: "Logo final dan brand guideline sudah dikirim, menunggu approval dari pemilik usaha.",
    milestones: [
      { id: "m1", name: "Riset merek & moodboard" },
      { id: "m2", name: "3 konsep logo" },
      { id: "m3", name: "Logo final" },
      { id: "m4", name: "Brand guideline ringkas" },
    ],
    deliverablesRequired: 5,
    events: [
      { date: "2026-08-25", type: "mulai", milestone: "m1" },
      { date: "2026-08-28", type: "upload", file: "riset-batik-asri.pdf" },
      { date: "2026-08-28", type: "kirim", milestone: "m1" },
      { date: "2026-08-29", type: "disetujui", milestone: "m1" },
      { date: "2026-09-01", type: "mulai", milestone: "m2" },
      { date: "2026-09-04", type: "upload", file: "konsep-logo-v1.pdf" },
      { date: "2026-09-04", type: "kirim", milestone: "m2" },
      { date: "2026-09-05", type: "revisi", milestone: "m2", note: "Motif parang dibuat lebih tegas" },
      { date: "2026-09-07", type: "upload", file: "konsep-logo-v2.pdf" },
      { date: "2026-09-07", type: "kirim", milestone: "m2" },
      { date: "2026-09-08", type: "disetujui", milestone: "m2" },
      { date: "2026-09-09", type: "mulai", milestone: "m3" },
      { date: "2026-09-11", type: "upload", file: "logo-final.ai" },
      { date: "2026-09-11", type: "kirim", milestone: "m3" },
      { date: "2026-09-12", type: "disetujui", milestone: "m3" },
      { date: "2026-09-12", type: "mulai", milestone: "m4" },
      { date: "2026-09-15", type: "upload", file: "brand-guideline-batik-asri.pdf" },
      { date: "2026-09-15", type: "kirim", milestone: "m4" },
    ],
  },
  {
    id: "mp3", title: "Pendaftaran & Optimasi Toko Shopee", client: "Snack Kriuk Ibu Tini", category: "Marketplace", status: "revisi",
    budget: 600000, startDate: "2026-09-02", deadline: "2026-09-20",
    description: "Klien minta judul dan foto 8 produk diperbaiki supaya lebih menarik di pencarian.",
    milestones: [
      { id: "m1", name: "Setup akun & profil toko" },
      { id: "m2", name: "Unggah 25 produk" },
      { id: "m3", name: "Optimasi judul & foto produk" },
    ],
    deliverablesRequired: 3,
    events: [
      { date: "2026-09-02", type: "mulai", milestone: "m1" },
      { date: "2026-09-03", type: "kirim", milestone: "m1" },
      { date: "2026-09-04", type: "disetujui", milestone: "m1" },
      { date: "2026-09-05", type: "mulai", milestone: "m2" },
      { date: "2026-09-08", type: "upload", file: "data-produk-25-item.xlsx" },
      { date: "2026-09-08", type: "kirim", milestone: "m2" },
      { date: "2026-09-09", type: "disetujui", milestone: "m2" },
      { date: "2026-09-10", type: "mulai", milestone: "m3" },
      { date: "2026-09-12", type: "upload", file: "foto-produk-edit.zip" },
      { date: "2026-09-12", type: "kirim", milestone: "m3" },
      { date: "2026-09-14", type: "revisi", milestone: "m3", note: "Judul & foto 8 produk perlu diperbaiki" },
    ],
  },
  {
    id: "mp4", title: "Website Company Profile Sederhana", client: "Berkah Furniture", category: "Website", status: "berjalan",
    budget: 3500000, startDate: "2026-09-05", deadline: "2026-10-10",
    description: "Struktur halaman sudah disetujui, sekarang masuk tahap desain visual.",
    milestones: [
      { id: "m1", name: "Struktur halaman & wireframe" },
      { id: "m2", name: "Desain UI 5 halaman" },
      { id: "m3", name: "Development & isi konten" },
      { id: "m4", name: "Uji coba & rilis" },
      { id: "m5", name: "Serah terima & pelatihan admin" },
    ],
    deliverablesRequired: 6,
    events: [
      { date: "2026-09-05", type: "mulai", milestone: "m1" },
      { date: "2026-09-07", type: "upload", file: "sitemap-berkah-furniture.pdf" },
      { date: "2026-09-07", type: "upload", file: "wireframe.fig" },
      { date: "2026-09-07", type: "kirim", milestone: "m1" },
      { date: "2026-09-09", type: "disetujui", milestone: "m1" },
      { date: "2026-09-10", type: "mulai", milestone: "m2" },
      { date: "2026-09-13", type: "upload", file: "desain-beranda.fig" },
    ],
  },
  {
    id: "mp5", title: "Rapikan Pembukuan 6 Bulan Terakhir", client: "Laundry Kilat Bersih", category: "Digital Bookkeeping", status: "selesai",
    budget: 800000, startDate: "2026-08-01", deadline: "2026-08-22",
    description: "Laporan laba rugi dan rekap kas sudah diserahkan dan disetujui klien.",
    milestones: [
      { id: "m1", name: "Rekap nota manual Feb–Jul" },
      { id: "m2", name: "Template spreadsheet kas harian" },
      { id: "m3", name: "Laporan laba rugi 6 bulan" },
    ],
    deliverablesRequired: 3,
    events: [
      { date: "2026-08-01", type: "mulai", milestone: "m1" },
      { date: "2026-08-06", type: "upload", file: "rekap-nota-feb-jul.xlsx" },
      { date: "2026-08-06", type: "kirim", milestone: "m1" },
      { date: "2026-08-07", type: "disetujui", milestone: "m1" },
      { date: "2026-08-08", type: "mulai", milestone: "m2" },
      { date: "2026-08-12", type: "upload", file: "template-kas-harian.xlsx" },
      { date: "2026-08-12", type: "kirim", milestone: "m2" },
      { date: "2026-08-13", type: "disetujui", milestone: "m2" },
      { date: "2026-08-14", type: "mulai", milestone: "m3" },
      { date: "2026-08-19", type: "upload", file: "laporan-laba-rugi.pdf" },
      { date: "2026-08-19", type: "kirim", milestone: "m3" },
      { date: "2026-08-20", type: "disetujui", milestone: "m3" },
    ],
  },
  {
    id: "mp6", title: "Desain Menu & Banner Promosi", client: "Warung Ibu Sari", category: "Graphic Design", status: "selesai",
    budget: 450000, startDate: "2026-08-05", deadline: "2026-08-19",
    description: "Menu dine-in baru dan 3 banner promosi sudah dikirim dan dipakai klien.",
    milestones: [
      { id: "m1", name: "Desain menu dine-in" },
      { id: "m2", name: "3 banner promosi media sosial" },
    ],
    deliverablesRequired: 3,
    events: [
      { date: "2026-08-05", type: "mulai", milestone: "m1" },
      { date: "2026-08-08", type: "upload", file: "menu-dine-in-draft.pdf" },
      { date: "2026-08-08", type: "kirim", milestone: "m1" },
      { date: "2026-08-09", type: "revisi", milestone: "m1", note: "Tambahkan foto menu andalan" },
      { date: "2026-08-11", type: "upload", file: "menu-dine-in-final.pdf" },
      { date: "2026-08-11", type: "kirim", milestone: "m1" },
      { date: "2026-08-12", type: "disetujui", milestone: "m1" },
      { date: "2026-08-13", type: "mulai", milestone: "m2" },
      { date: "2026-08-16", type: "upload", file: "banner-promo-1-3.zip" },
      { date: "2026-08-16", type: "kirim", milestone: "m2" },
      { date: "2026-08-17", type: "disetujui", milestone: "m2" },
    ],
  },
  {
    id: "mp7", title: "Konten TikTok Mingguan", client: "Kedai Seduh Nusantara", category: "Social Media", status: "dibatalkan",
    budget: 900000, startDate: "2026-08-20", deadline: "2026-09-05",
    description: "Proyek dibatalkan klien karena anggaran promosi dipangkas kuartal ini.",
    milestones: [
      { id: "m1", name: "Riset tren & script video" },
      { id: "m2", name: "Produksi 4 video" },
      { id: "m3", name: "Posting & laporan performa" },
    ],
    deliverablesRequired: 5,
    events: [
      { date: "2026-08-20", type: "mulai", milestone: "m1" },
      { date: "2026-08-23", type: "upload", file: "script-tiktok-minggu-1.docx" },
      { date: "2026-08-24", type: "kirim", milestone: "m1" },
      { date: "2026-08-28", type: "batal", note: "anggaran promosi dipangkas" },
    ],
  },
  {
    id: "mp8", title: "Redesain Kemasan Produk Sambal", client: "Sambal Bu Yuli", category: "Graphic Design", status: "selesai",
    budget: 1200000, startDate: "2026-08-15", deadline: "2026-10-05",
    description: "Desain kemasan baru untuk 3 varian sambal, sudah naik cetak.",
    milestones: [
      { id: "m1", name: "Riset kemasan & kompetitor" },
      { id: "m2", name: "Desain 3 varian kemasan" },
      { id: "m3", name: "File siap cetak (CMYK)" },
    ],
    deliverablesRequired: 4,
    events: [
      { date: "2026-08-15", type: "mulai", milestone: "m1" },
      { date: "2026-08-18", type: "upload", file: "riset-kemasan.pdf" },
      { date: "2026-08-18", type: "kirim", milestone: "m1" },
      { date: "2026-08-19", type: "disetujui", milestone: "m1" },
      { date: "2026-08-20", type: "mulai", milestone: "m2" },
      { date: "2026-08-24", type: "upload", file: "desain-3-varian-v1.pdf" },
      { date: "2026-08-24", type: "kirim", milestone: "m2" },
      { date: "2026-08-25", type: "revisi", milestone: "m2", note: "Warna varian pedas dibuat lebih merah" },
      { date: "2026-08-27", type: "upload", file: "desain-3-varian-final.pdf" },
      { date: "2026-08-27", type: "kirim", milestone: "m2" },
      { date: "2026-08-28", type: "disetujui", milestone: "m2" },
      { date: "2026-08-29", type: "mulai", milestone: "m3" },
      { date: "2026-08-31", type: "upload", file: "file-cetak-cmyk.zip" },
      { date: "2026-08-31", type: "kirim", milestone: "m3" },
      { date: "2026-09-01", type: "disetujui", milestone: "m3" },
    ],
  },
  // --- Proyek lama (sudah selesai) — dipakai juga oleh riwayat Penghasilan ---
  {
    id: "mp9", title: "Foto Produk & Katalog Digital", client: "Toko Kue Bu Rina", category: "Graphic Design", status: "selesai",
    budget: 700000, startDate: "2026-04-06", deadline: "2026-04-25",
    description: "Foto 20 produk kue kering dan katalog digital PDF untuk dibagikan lewat WhatsApp.",
    milestones: [
      { id: "m1", name: "Sesi foto 20 produk" },
      { id: "m2", name: "Katalog digital PDF" },
    ],
    deliverablesRequired: 2,
    events: [
      { date: "2026-04-06", type: "mulai", milestone: "m1" },
      { date: "2026-04-11", type: "upload", file: "foto-produk-edit.zip" },
      { date: "2026-04-11", type: "kirim", milestone: "m1" },
      { date: "2026-04-12", type: "disetujui", milestone: "m1" },
      { date: "2026-04-13", type: "mulai", milestone: "m2" },
      { date: "2026-04-17", type: "upload", file: "katalog-bu-rina.pdf" },
      { date: "2026-04-17", type: "kirim", milestone: "m2" },
      { date: "2026-04-18", type: "disetujui", milestone: "m2" },
    ],
  },
  {
    id: "mp10", title: "Laporan Stok & Kas Mingguan", client: "Toko Sembako Berkah Jaya", category: "Digital Bookkeeping", status: "selesai",
    budget: 650000, startDate: "2026-06-08", deadline: "2026-06-26",
    description: "Template stok barang dan kas mingguan, lengkap dengan panduan pengisian untuk pemilik toko.",
    milestones: [
      { id: "m1", name: "Template stok barang" },
      { id: "m2", name: "Template kas mingguan & panduan" },
    ],
    deliverablesRequired: 3,
    events: [
      { date: "2026-06-08", type: "mulai", milestone: "m1" },
      { date: "2026-06-12", type: "upload", file: "template-stok.xlsx" },
      { date: "2026-06-12", type: "kirim", milestone: "m1" },
      { date: "2026-06-13", type: "disetujui", milestone: "m1" },
      { date: "2026-06-15", type: "mulai", milestone: "m2" },
      { date: "2026-06-19", type: "upload", file: "template-kas-mingguan.xlsx" },
      { date: "2026-06-19", type: "upload", file: "panduan-pengisian.pdf" },
      { date: "2026-06-19", type: "kirim", milestone: "m2" },
      { date: "2026-06-20", type: "disetujui", milestone: "m2" },
    ],
  },
  {
    id: "mp11", title: "Landing Page Pre-order Batik", client: "Batik Asri Nusantara", category: "Website", status: "selesai",
    budget: 1800000, startDate: "2026-07-01", deadline: "2026-07-31",
    description: "Landing page pre-order koleksi batik premium dengan formulir pemesanan terhubung ke WhatsApp.",
    milestones: [
      { id: "m1", name: "Desain landing page" },
      { id: "m2", name: "Development & formulir pre-order" },
      { id: "m3", name: "Rilis & serah terima" },
    ],
    deliverablesRequired: 3,
    events: [
      { date: "2026-07-01", type: "mulai", milestone: "m1" },
      { date: "2026-07-06", type: "upload", file: "desain-landing-page.fig" },
      { date: "2026-07-06", type: "kirim", milestone: "m1" },
      { date: "2026-07-08", type: "disetujui", milestone: "m1" },
      { date: "2026-07-09", type: "mulai", milestone: "m2" },
      { date: "2026-07-18", type: "upload", file: "source-code-landing.zip" },
      { date: "2026-07-18", type: "kirim", milestone: "m2" },
      { date: "2026-07-20", type: "disetujui", milestone: "m2" },
      { date: "2026-07-21", type: "mulai", milestone: "m3" },
      { date: "2026-07-25", type: "upload", file: "panduan-admin.pdf" },
      { date: "2026-07-25", type: "kirim", milestone: "m3" },
      { date: "2026-07-26", type: "disetujui", milestone: "m3" },
    ],
  },
].map((p) => enrichProject(p, MOCK_TODAY));

const SAVED_PROJECTS = [
  { id: "sp1", title: "Optimasi SEO Website Toko", client: "Kedai Kopi Senja", category: "Website", status: "terbuka", budget: 1100000, deadline: "2026-10-15", location: "Bandung (Remote)", saved: true, description: "Perbaikan SEO on-page dan kecepatan loading untuk website katalog kopi." },
  { id: "sp2", title: "Ilustrasi Kemasan Produk Snack", client: "Snack Kriuk Ibu Tini", category: "Graphic Design", status: "terbuka", budget: 700000, deadline: "2026-10-08", location: "Bandung (Remote)", saved: true, description: "Ilustrasi karakter untuk kemasan 2 varian rasa baru." },
  { id: "sp3", title: "Setup Toko Tokopedia + Katalog", client: "Batik Asri Nusantara", category: "Marketplace", status: "terbuka", budget: 650000, deadline: "2026-10-12", location: "Solo (Remote)", saved: true, description: "Migrasi katalog 40 produk dari Shopee ke Tokopedia, lengkap dengan deskripsi." },
  { id: "sp4", title: "Laporan Keuangan Bulanan", client: "Roti Bakar Pak Jono", category: "Digital Bookkeeping", status: "terbuka", budget: 500000, deadline: "2026-10-20", location: "Jakarta (Remote)", saved: true, description: "Susun laporan kas masuk-keluar bulanan dalam format spreadsheet siap pakai." },
];

export function getActiveProjects() {
  if (USE_EMPTY_STATE) return [];
  return MY_PROJECTS.filter((p) => ACTIVE_STATUSES.includes(p.status));
}

export function getAllProjects() {
  if (USE_EMPTY_STATE) return [];
  return MY_PROJECTS;
}

export function getSavedProjects() {
  if (USE_EMPTY_STATE) return [];
  return SAVED_PROJECTS;
}
