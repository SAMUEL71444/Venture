// Laporan/sengketa yang ditangani Verify & Trust. `projectId` (kalau ada)
// menghubungkan laporan ke proyek asli (lib/projects.mock.js atau
// lib/platform-projects.mock.js) — dari situ lib/escrow.js tahu proyek mana
// yang dana termin-nya harus dibekukan otomatis selama laporan BELUM selesai.

export const REPORT_CATEGORY_META = {
  penipuan: { label: "Penipuan", badgeClass: "badge-error" },
  kerja_tidak_sesuai: { label: "Kerja Tidak Sesuai", badgeClass: "badge-warning" },
  pelanggaran_lain: { label: "Pelanggaran Lain", badgeClass: "badge-neutral" },
};

export const REPORT_STATUS_META = {
  baru: { label: "Baru", badgeClass: "badge-info" },
  diproses: { label: "Diproses", badgeClass: "badge-warning" },
  selesai: { label: "Selesai", badgeClass: "badge-success" },
};

export const REPORTS = [
  {
    // handledBy = ID Admin penangani (lib/users.mock.js ADMINS); tiap `actions`
    // juga membawa adminId dan (kalau menyentuh dana) txId, supaya log
    // aktivitas & statistik Verify & Trust bisa dihitung dari sini.
    id: "rep1", category: "kerja_tidak_sesuai", status: "diproses", handledBy: "VT-0142",
    projectId: "mp3", reportedBy: "umkm", reporterName: "Snack Kriuk Ibu Tini", against: "Nadia Putri",
    title: "Hasil revisi judul & foto produk belum sesuai permintaan",
    openedAt: "2026-09-13",
    chronology: [
      { date: "2026-09-12", note: "Klien menolak milestone 3 (optimasi judul & foto), minta 8 produk direvisi." },
      { date: "2026-09-13", note: "Klien melapor ke Verify & Trust karena revisi kedua belum juga dikirim." },
      { date: "2026-09-14", note: "Tim Verify & Trust membekukan dana milestone 3 sambil menunggu klarifikasi." },
    ],
    actions: [
      { date: "2026-09-14", by: "Rizky Pratama", adminId: "VT-0142", note: "Dana milestone 3 dibekukan sementara.", txId: "mp3-m3" },
    ],
  },
  {
    id: "rep2", category: "penipuan", status: "baru", handledBy: null,
    projectId: "pp4", reportedBy: "mahasiswa", reporterName: "Kirana Ayu", against: "Kedai Seduh Nusantara",
    title: "Diduga memakai identitas usaha yang belum terverifikasi",
    openedAt: "2026-09-14",
    chronology: [
      { date: "2026-09-14", note: "Kirana Ayu melapor: nama usaha di brief tidak cocok dengan NIB yang pernah disebut klien." },
    ],
    actions: [],
  },
  {
    // Membekukan dana milestone 1 pp6 (lihat lib/escrow.js) — terlihat sama
    // di Pembayaran (Kopi Anteng) dan Transaksi & Dana (Verify & Trust).
    id: "rep4", category: "kerja_tidak_sesuai", status: "diproses", handledBy: "VT-0142",
    projectId: "pp6", reportedBy: "umkm", reporterName: "Kopi Anteng", against: "Rangga Saputra",
    title: "Landing page tidak sesuai mockup yang disepakati",
    openedAt: "2026-09-13",
    chronology: [
      { date: "2026-09-12", note: "Klien minta revisi milestone 1: tata letak dan warna berbeda dari mockup." },
      { date: "2026-09-13", note: "Klien melapor ke Verify & Trust dan minta dana milestone 1 ditahan dulu." },
      { date: "2026-09-14", note: "Tim Verify & Trust meminta kedua pihak mengirim mockup dan file final untuk dibandingkan." },
    ],
    actions: [
      { date: "2026-09-14", by: "Rizky Pratama", adminId: "VT-0142", note: "Dana milestone 1 dibekukan sementara selama peninjauan.", txId: "pp6-m1" },
    ],
  },
  {
    id: "rep3", category: "pelanggaran_lain", status: "selesai", handledBy: "VT-0142",
    projectId: "mp7", reportedBy: "mahasiswa", reporterName: "Nadia Putri", against: "Kedai Seduh Nusantara",
    title: "Komunikasi tidak profesional sebelum proyek dibatalkan",
    openedAt: "2026-08-27",
    chronology: [
      { date: "2026-08-27", note: "Nadia melapor nada bicara klien di chat dianggap tidak pantas." },
      { date: "2026-08-29", note: "Tim Verify & Trust meninjau riwayat chat kedua pihak." },
      { date: "2026-08-30", note: "Klien diberi peringatan tertulis. Kasus ditutup." },
    ],
    actions: [
      { date: "2026-08-30", by: "Rizky Pratama", adminId: "VT-0142", note: "Peringatan tertulis dikirim ke Kedai Seduh Nusantara, kasus ditutup." },
    ],
  },
];

// Proyek dengan laporan yang BELUM "selesai" -> termin yang belum dicairkan
// dibekukan otomatis (lihat lib/escrow.js, fundStatusOfTerm).
export function activeReportProjectIds() {
  return new Set(REPORTS.filter((r) => r.status !== "selesai" && r.projectId).map((r) => r.projectId));
}
