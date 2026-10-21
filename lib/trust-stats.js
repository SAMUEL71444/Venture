// Statistik kinerja admin Verify & Trust — SEMUA dihitung dari log aktivitas
// terpusat (lib/activity-log.js) dan laporan efektif, tanpa angka tetap.
// Kalau data di fitur manapun berubah (admin menyetujui verifikasi,
// membekukan dana, menyelesaikan laporan), angka di Profil ikut berubah.
import { sortLogDesc } from "./activity-log";

const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (fromIso, toIso) => Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / DAY));

// `entries` = log lengkap, `reports` = effectiveReports(entries).
export function adminStats(adminId, { entries, reports }) {
  const mine = entries.filter((e) => e.adminId === adminId);

  const verifikasi = mine.filter((e) => e.category === "verifikasi");
  // Transaksi yang pernah disentuh admin ini: dana yang ditindak langsung
  // maupun dibekukan lewat penanganan laporan.
  const txIds = [...new Set(mine.map((e) => e.refs.txId).filter(Boolean))];
  const laporanSelesai = reports.filter((r) => r.status === "selesai" && r.handledBy === adminId);

  // Waktu respons (hari): kapan masuk -> kapan admin ini pertama merespons.
  const durations = [];
  verifikasi.forEach((e) => {
    if (e.meta.joinedAt) durations.push(daysBetween(e.meta.joinedAt, e.at.slice(0, 10)));
  });
  reports.forEach((r) => {
    const first = r.actions.find((a) => a.adminId === adminId);
    if (first) durations.push(daysBetween(r.openedAt, first.date));
  });
  const avgResponseDays = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : null;

  return {
    verifikasiDiproses: verifikasi.length,
    transaksiDiawasi: txIds.length,
    transaksiIds: txIds,
    laporanDitangani: laporanSelesai.length,
    avgResponseDays,
    responseSamples: durations.length,
  };
}

export function recentActivity(entries, adminId, limit = 5) {
  return sortLogDesc(entries.filter((e) => e.adminId === adminId)).slice(0, limit);
}
