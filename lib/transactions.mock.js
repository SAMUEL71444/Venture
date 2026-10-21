// SATU-SATUNYA daftar jadwal termin pembayaran (escrow) seluruh platform.
// Dulu terpecah dua: PAYMENT_TERMS (proyek Nadia, di earnings.mock.js) dan
// PLATFORM_PAYMENT_TERMS (freelancer lain, di platform-projects.mock.js).
// Sekarang digabung di sini dalam urutan yang sama, dan dipakai bersama oleh
// ketiga sudut pandang lewat lib/transactions.js:
//   - UMKM (Pembayaran)        -> disaring umkmId
//   - Mahasiswa (Penghasilan)  -> disaring mahasiswaId
//   - Verify & Trust (Transaksi & Dana, Profil) -> semua
// File ini sengaja TIDAK menyimpan status/tanggal/nominal/ID pihak — cuma
// jadwal termin (proyek mana, milestone mana, berapa persen, metode). Sisanya
// dihitung lib/escrow.js dari log event proyek.
//
// { projectId, milestoneId, persen (dari anggaran proyek), metode }
// Nggak semua milestone yang disetujui otomatis jadi termin di sini — ini
// representasi jadwal pembayaran yang disepakati di awal proyek, bukan
// pencatatan otomatis semua progres.
export const PAYMENT_TERMS = [
  // --- Proyek Nadia (mp*) ---
  { projectId: "mp1", milestoneId: "m1", persen: 0.25, metode: "Transfer Bank BCA" },
  { projectId: "mp4", milestoneId: "m1", persen: 0.20, metode: "Transfer Bank BCA" },

  { projectId: "mp2", milestoneId: "m2", persen: 0.30, metode: "Transfer Bank BCA" },
  { projectId: "mp2", milestoneId: "m3", persen: 0.40, metode: "Transfer Bank BCA" },
  { projectId: "mp2", milestoneId: "m4", persen: 0.30, metode: "Transfer Bank BCA" },

  { projectId: "mp3", milestoneId: "m2", persen: 0.60, metode: "GoPay" },
  { projectId: "mp3", milestoneId: "m3", persen: 0.40, metode: "GoPay" },

  { projectId: "mp5", milestoneId: "m3", persen: 1, metode: "Transfer Bank BCA" },
  { projectId: "mp6", milestoneId: "m2", persen: 1, metode: "GoPay" },
  { projectId: "mp8", milestoneId: "m3", persen: 1, metode: "Transfer Bank BCA" },
  { projectId: "mp9", milestoneId: "m2", persen: 1, metode: "GoPay" },
  { projectId: "mp10", milestoneId: "m2", persen: 1, metode: "Transfer Bank BCA" },
  { projectId: "mp11", milestoneId: "m3", persen: 1, metode: "Transfer Bank BCA" },

  // mp7 dibatalkan sebelum milestone ini disetujui -> dana dikembalikan ke
  // UMKM (lihat lib/escrow.js), bukan masuk penghasilan Nadia. Tetap
  // ditampilkan di Penghasilan supaya kelihatan kenapa termin ini nggak
  // pernah cair, bukan cuma "hilang" dari daftar.
  { projectId: "mp7", milestoneId: "m1", persen: 0.3, metode: "GoPay" },

  // --- Proyek freelancer lain (pp*) ---
  { projectId: "pp1", milestoneId: "m1", persen: 0.3, metode: "Transfer Bank BCA" },
  { projectId: "pp1", milestoneId: "m2", persen: 0.7, metode: "Transfer Bank BCA" },
  { projectId: "pp2", milestoneId: "m1", persen: 0.2, metode: "GoPay" },
  { projectId: "pp2", milestoneId: "m2", persen: 0.5, metode: "GoPay" },
  { projectId: "pp2", milestoneId: "m3", persen: 0.3, metode: "GoPay" },
  { projectId: "pp3", milestoneId: "m1", persen: 0.5, metode: "Transfer Bank BCA" },
  { projectId: "pp4", milestoneId: "m1", persen: 0.3, metode: "GoPay" },
  { projectId: "pp5", milestoneId: "m1", persen: 0.5, metode: "Transfer Bank BCA" },
  { projectId: "pp6", milestoneId: "m1", persen: 0.4, metode: "Transfer Bank BCA" },
  { projectId: "pp7", milestoneId: "m1", persen: 0.5, metode: "GoPay" },
  { projectId: "pp8", milestoneId: "m1", persen: 0.4, metode: "Transfer Bank BCA" },
  { projectId: "pp8", milestoneId: "m2", persen: 0.6, metode: "Transfer Bank BCA" },
  { projectId: "pp9", milestoneId: "m1", persen: 1, metode: "Transfer Bank BCA" },
];
