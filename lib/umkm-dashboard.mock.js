// Skenario uji untuk dashboard UMKM (/dashboard, role umkm). Ganti
// UMKM_SCENARIO ke "baru" untuk melihat kondisi UMKM yang belum selesai
// onboarding; di halaman dashboard juga ada tombol "Mode uji" kecil di
// bawah supaya kedua skenario bisa dicek tanpa mengubah kode.
//
// Skenario "baru" cuma MENYEMBUNYIKAN data di dashboard ini (email belum
// verifikasi, belum ada metode pembayaran, tidak ada proyek) — data bersama
// (proyek, escrow, Pengaturan) tidak diubah, jadi halaman lain tidak ikut
// berubah.
export const UMKM_SCENARIO = "aktif";

export const SCENARIOS = {
  aktif: { label: "UMKM aktif", emailVerified: true, hasPaymentMethod: true, hasProjects: true },
  baru: { label: "UMKM baru", emailVerified: false, hasPaymentMethod: false, hasProjects: false },
};
