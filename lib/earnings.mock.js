// Data dummy khusus halaman "Penghasilan" (mahasiswa). Sengaja TIDAK
// menyimpan judul proyek/klien/tanggal/jumlah/status transaksi secara
// manual — cuma jadwal termin (proyek mana, milestone mana, berapa persen).
// Sisanya (status, tanggal, jumlah bersih) dihitung oleh lib/earnings.js dari
// data proyek yang sama dengan halaman Proyek Saya (lib/projects.mock.js),
// supaya kedua halaman selalu bercerita hal yang sama.

export const PLATFORM_FEE = 0.10; // biaya platform 10% dari tiap termin
export const PAYOUT_DAYS = 3;     // milestone disetujui < 3 hari lalu -> masih "Diproses"

export const SAVED_ACCOUNTS = [
  { id: "acc1", label: "BCA •••• 4821", holder: "Nadia Putri" },
  { id: "acc2", label: "GoPay 0812 •••• 7730", holder: "Nadia Putri" },
];

// Jadwal termin pembayaran (PAYMENT_TERMS) pindah ke lib/transactions.mock.js
// — SATU daftar untuk semua role, bukan lagi dipecah per file.

// Semua tanggal & jumlah di bawah sengaja dijaga supaya nggak pernah
// melebihi saldo tersedia pada tanggal itu (dicek manual terhadap total
// transaksi "selesai" berjalan) — lihat catatan perhitungan di plan.
export const WITHDRAWALS = [
  { id: "wd1", date: "2026-05-01", amount: 500000, accountId: "acc1", status: "berhasil" },
  { id: "wd2", date: "2026-08-01", amount: 1000000, accountId: "acc1", status: "berhasil" },
  { id: "wd3", date: "2026-08-25", amount: 800000, accountId: "acc2", status: "diproses" },
  { id: "wd4", date: "2026-09-05", amount: 1500000, accountId: "acc2", status: "gagal", note: "Nama pemilik rekening tidak sesuai — dana dikembalikan ke saldo" },
  { id: "wd5", date: "2026-09-10", amount: 2000000, accountId: "acc1", status: "berhasil" },
  { id: "wd6", date: "2026-09-14", amount: 1000000, accountId: "acc1", status: "berhasil" },
];
