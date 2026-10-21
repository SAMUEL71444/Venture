import { enrichProject } from "./progress";
import { MOCK_TODAY } from "./projects.mock";

// Proyek freelancer LAIN (bukan Nadia) di platform, format mentahnya sama
// persis dengan MY_PROJECTS (lib/projects.mock.js) — milestone + log event,
// progress/status milestone/file dihitung ulang oleh lib/progress.js, bukan
// ditulis manual. Dipakai buat:
//  - halaman "Proyek" sudut pandang UMKM (satu UMKM, banyak freelancer)
//  - /escrow, /quality, /users, /reports di sisi Verify & Trust
// Tiga proyek pertama SENGAJA dicocokkan dengan baris statis yang sudah ada
// di app/umkm/dashboard/page.js (Farhan/Logo, Bagas/Shopee, + punya Nadia
// yang sudah ada di projects.mock.js) supaya nggak kontradiksi begitu
// halaman itu ikut dipindah ke data asli.
const PLATFORM_PROJECTS = [
  {
    id: "pp1", title: "Pembuatan Logo & Panduan Merek", client: "Kopi Anteng", freelancerId: "s4", freelancerName: "Farhan Maulana",
    category: "Branding", status: "berjalan", budget: 1800000, startDate: "2026-09-05", deadline: "2026-09-24",
    description: "Logo baru dan panduan merek ringkas untuk lini produk kopi kemasan.",
    milestones: [
      { id: "m1", name: "Riset merek & moodboard" },
      { id: "m2", name: "3 konsep logo" },
      { id: "m3", name: "Logo final & panduan" },
    ],
    deliverablesRequired: 4,
    events: [
      { date: "2026-09-05", type: "mulai", milestone: "m1" },
      { date: "2026-09-08", type: "upload", file: "moodboard-kopi-anteng.pdf" },
      { date: "2026-09-08", type: "kirim", milestone: "m1" },
      { date: "2026-09-09", type: "disetujui", milestone: "m1" },
      { date: "2026-09-10", type: "mulai", milestone: "m2" },
      { date: "2026-09-14", type: "upload", file: "konsep-logo-v1.pdf" },
    ],
  },
  {
    id: "pp2", title: "Pendaftaran & Optimasi Toko Shopee", client: "Kopi Anteng", freelancerId: "s6", freelancerName: "Bagas Wirawan",
    category: "Marketplace", status: "menunggu_review", budget: 900000, startDate: "2026-08-28", deadline: "2026-09-16",
    description: "Setup toko Shopee dan optimasi judul/foto untuk 20 varian kopi kemasan.",
    milestones: [
      { id: "m1", name: "Setup akun & profil toko" },
      { id: "m2", name: "Unggah 20 produk" },
      { id: "m3", name: "Pengiriman akhir & laporan" },
    ],
    deliverablesRequired: 3,
    events: [
      { date: "2026-08-28", type: "mulai", milestone: "m1" },
      { date: "2026-08-30", type: "kirim", milestone: "m1" },
      { date: "2026-08-31", type: "disetujui", milestone: "m1" },
      { date: "2026-09-01", type: "mulai", milestone: "m2" },
      { date: "2026-09-06", type: "upload", file: "data-produk-20-item.xlsx" },
      { date: "2026-09-06", type: "kirim", milestone: "m2" },
      { date: "2026-09-07", type: "disetujui", milestone: "m2" },
      { date: "2026-09-08", type: "mulai", milestone: "m3" },
      { date: "2026-09-14", type: "upload", file: "laporan-akhir-shopee.pdf" },
      { date: "2026-09-14", type: "kirim", milestone: "m3" },
    ],
  },
  {
    id: "pp3", title: "Rapikan Pembukuan Bulanan", client: "Batik Asri Nusantara", freelancerId: "s3", freelancerName: "Dewi Lestari",
    category: "Digital Bookkeeping", status: "revisi", budget: 700000, startDate: "2026-09-01", deadline: "2026-09-18",
    description: "Migrasi catatan manual ke spreadsheet dan laporan laba rugi bulanan.",
    milestones: [
      { id: "m1", name: "Migrasi data ke spreadsheet" },
      { id: "m2", name: "Laporan laba rugi" },
    ],
    deliverablesRequired: 2,
    events: [
      { date: "2026-09-01", type: "mulai", milestone: "m1" },
      { date: "2026-09-04", type: "upload", file: "rekap-transaksi.xlsx" },
      { date: "2026-09-04", type: "kirim", milestone: "m1" },
      { date: "2026-09-05", type: "disetujui", milestone: "m1" },
      { date: "2026-09-06", type: "mulai", milestone: "m2" },
      { date: "2026-09-10", type: "upload", file: "laporan-laba-rugi-draft.xlsx" },
      { date: "2026-09-10", type: "kirim", milestone: "m2" },
      { date: "2026-09-12", type: "revisi", milestone: "m2", note: "Kategori pengeluaran perlu dipisah lebih detail" },
    ],
  },
  {
    id: "pp4", title: "Konten TikTok & Reels Mingguan", client: "Kedai Seduh Nusantara", freelancerId: "s5", freelancerName: "Kirana Ayu",
    category: "Social Media", status: "berjalan", budget: 1100000, startDate: "2026-09-08", deadline: "2026-09-29",
    description: "Produksi 8 video TikTok/Reels untuk promosi menu musim hujan.",
    milestones: [
      { id: "m1", name: "Script & storyboard" },
      { id: "m2", name: "Produksi 4 video pertama" },
      { id: "m3", name: "Produksi 4 video kedua" },
    ],
    deliverablesRequired: 8,
    events: [
      { date: "2026-09-08", type: "mulai", milestone: "m1" },
      { date: "2026-09-10", type: "upload", file: "script-minggu-1.docx" },
      { date: "2026-09-10", type: "kirim", milestone: "m1" },
      { date: "2026-09-13", type: "disetujui", milestone: "m1" },
      { date: "2026-09-13", type: "mulai", milestone: "m2" },
    ],
  },
  // pp5–pp9: proyek Kopi Anteng tambahan supaya halaman Pembayaran UMKM
  // (/payments) punya riwayat yang cukup — sengaja ditaruh di SINI (data
  // bersama), bukan di file khusus UMKM, supaya status & nominalnya ikut
  // terlihat sama di Transaksi & Dana (Verify & Trust). Status dananya tetap
  // dihitung lib/escrow.js dari event di bawah, tidak ditulis manual.
  {
    // disetujui 13 Sep, MOCK_TODAY 15 Sep -> masih "diproses" (≤ PAYOUT_DAYS)
    id: "pp5", title: "Laporan Keuangan Bulanan", client: "Kopi Anteng", freelancerId: "s3", freelancerName: "Dewi Lestari",
    category: "Digital Bookkeeping", status: "berjalan", budget: 600000, startDate: "2026-09-02", deadline: "2026-09-26",
    description: "Rekap kas Agustus dan template laporan bulanan untuk dua cabang.",
    milestones: [
      { id: "m1", name: "Rekap kas Agustus" },
      { id: "m2", name: "Template laporan bulanan" },
    ],
    deliverablesRequired: 2,
    events: [
      { date: "2026-09-02", type: "mulai", milestone: "m1" },
      { date: "2026-09-11", type: "upload", file: "rekap-kas-agustus.xlsx" },
      { date: "2026-09-11", type: "kirim", milestone: "m1" },
      { date: "2026-09-13", type: "disetujui", milestone: "m1" },
      { date: "2026-09-13", type: "mulai", milestone: "m2" },
    ],
  },
  {
    // ada laporan aktif (rep4, lib/reports.mock.js) -> dana dibekukan
    id: "pp6", title: "Landing Page Promo Kopi Kemasan", client: "Kopi Anteng", freelancerId: "s2", freelancerName: "Rangga Saputra",
    category: "Website", status: "revisi", budget: 1500000, startDate: "2026-09-03", deadline: "2026-09-24",
    description: "Landing page promo kopi kemasan dengan form pre-order dan integrasi WhatsApp.",
    milestones: [
      { id: "m1", name: "Desain & halaman utama" },
      { id: "m2", name: "Form pre-order & rilis" },
    ],
    deliverablesRequired: 3,
    events: [
      { date: "2026-09-03", type: "mulai", milestone: "m1" },
      { date: "2026-09-10", type: "upload", file: "landing-promo-v1.zip" },
      { date: "2026-09-10", type: "kirim", milestone: "m1" },
      { date: "2026-09-12", type: "revisi", milestone: "m1", note: "Halaman tidak sesuai mockup yang disepakati" },
    ],
  },
  {
    // dibatalkan sebelum milestone disetujui -> dana dikembalikan ke UMKM
    id: "pp7", title: "Video Promosi Menu Baru", client: "Kopi Anteng", freelancerId: "s5", freelancerName: "Kirana Ayu",
    category: "Social Media", status: "dibatalkan", budget: 800000, startDate: "2026-08-10", deadline: "2026-08-30",
    description: "Dibatalkan karena peluncuran menu baru diundur ke bulan depan.",
    milestones: [
      { id: "m1", name: "Konsep & storyboard" },
      { id: "m2", name: "Produksi 3 video" },
    ],
    deliverablesRequired: 4,
    events: [
      { date: "2026-08-10", type: "mulai", milestone: "m1" },
      { date: "2026-08-15", type: "upload", file: "storyboard-menu-baru.pdf" },
      { date: "2026-08-15", type: "kirim", milestone: "m1" },
      { date: "2026-08-20", type: "batal", note: "peluncuran menu baru diundur" },
    ],
  },
  {
    id: "pp8", title: "Foto Produk & Menu Digital", client: "Kopi Anteng", freelancerId: "s4", freelancerName: "Farhan Maulana",
    category: "Graphic Design", status: "selesai", budget: 1200000, startDate: "2026-06-02", deadline: "2026-07-10",
    description: "Foto 25 produk kopi kemasan dan menu digital untuk QR di meja.",
    milestones: [
      { id: "m1", name: "Foto produk 25 item" },
      { id: "m2", name: "Menu digital & QR" },
    ],
    deliverablesRequired: 2,
    events: [
      { date: "2026-06-02", type: "mulai", milestone: "m1" },
      { date: "2026-06-18", type: "upload", file: "foto-produk-25-item.zip" },
      { date: "2026-06-18", type: "kirim", milestone: "m1" },
      { date: "2026-06-20", type: "disetujui", milestone: "m1" },
      { date: "2026-06-22", type: "mulai", milestone: "m2" },
      { date: "2026-07-06", type: "upload", file: "menu-digital-qr.pdf" },
      { date: "2026-07-06", type: "kirim", milestone: "m2" },
      { date: "2026-07-08", type: "disetujui", milestone: "m2" },
    ],
  },
  {
    id: "pp9", title: "Setup Pembukuan Kasir", client: "Kopi Anteng", freelancerId: "s3", freelancerName: "Dewi Lestari",
    category: "Digital Bookkeeping", status: "selesai", budget: 650000, startDate: "2026-04-06", deadline: "2026-04-30",
    description: "Setup pencatatan kasir harian dan rekap stok bahan baku.",
    milestones: [
      { id: "m1", name: "Template kasir & stok" },
    ],
    deliverablesRequired: 1,
    events: [
      { date: "2026-04-06", type: "mulai", milestone: "m1" },
      { date: "2026-04-25", type: "upload", file: "template-kasir-stok.xlsx" },
      { date: "2026-04-25", type: "kirim", milestone: "m1" },
      { date: "2026-04-28", type: "disetujui", milestone: "m1" },
    ],
  },
].map((p) => enrichProject(p, MOCK_TODAY));

// Jadwal termin pembayaran proyek-proyek di atas (dulu PLATFORM_PAYMENT_TERMS)
// pindah ke lib/transactions.mock.js, digabung dengan termin proyek Nadia.

// PINTU TUNGGAL daftar proyek seluruh platform. Data mentahnya tetap di dua
// file (projects.mock.js = Nadia, terikat toggle USE_EMPTY_STATE "Proyek
// Saya"; file ini = freelancer lain), tapi semua halaman membaca lewat
// fungsi ini. `freelancerId` ditempel ke proyek Nadia tanpa mengubah
// filenya, dan SETIAP proyek mendapat ID pihak yang eksplisit:
//   umkmId      = pemilik proyek (UMKM, lihat lib/directory.js)
//   mahasiswaId = freelancernya
import { userIdFor, mahasiswaIdOf } from "./directory";

function withIds(p) {
  return { ...p, umkmId: userIdFor("umkm", p.client), mahasiswaId: mahasiswaIdOf(p.freelancerId) };
}

export function getPlatformProjects(myProjects) {
  const mine = myProjects.map((p) => ({ ...p, freelancerId: "s1", freelancerName: "Nadia Putri" }));
  return [...mine, ...PLATFORM_PROJECTS].map(withIds);
}
