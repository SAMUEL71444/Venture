// Log aktivitas admin Verify & Trust — SATU struktur untuk semua fitur
// (verifikasi pengguna, pengawasan dana/escrow, laporan & sengketa). Setiap
// aksi admin di fitur manapun ditambahkan ke log yang sama (lewat
// context/ActivityLogContext.js), jadi kartu "Aktivitas Terbaru" dan
// statistik di Profil Verify & Trust otomatis mencakup semuanya.
//
// Bentuk entri:
//   { id, seq, at (ISO), adminId, adminName,
//     category: "verifikasi" | "escrow" | "laporan", action, summary,
//     refs: { txId?, projectId?, userId?, reportId? },   // relasi eksplisit
//     meta: { reason?, status?, note?, joinedAt? }, seed? }
//
// Entri awal (`seed: true`) DITURUNKAN dari data yang sudah ada — akun
// terverifikasi (lib/users.mock.js) dan tindakan pada laporan
// (lib/reports.mock.js) — bukan diketik ulang di sini. Aksi sesi ini
// ditambahkan di runtime. Saat backend dipasang, ganti buildSeedLog() dengan
// hasil query log dari API; selektor di bawah tetap sama.
import { PLATFORM_USERS } from "./users.mock";
import { REPORTS } from "./reports.mock";
import { userIdFor, adminName } from "./directory";

export const CATEGORY_META = {
  verifikasi: { label: "Verifikasi", icon: "shield" },
  escrow: { label: "Dana", icon: "wallet" },
  laporan: { label: "Laporan", icon: "flag" },
};

export const ESCROW_ACTION_LABELS = {
  cairkan: "Cairkan Manual",
  bekukan: "Bekukan Dana",
  kembalikan: "Kembalikan ke UMKM",
};

// Entri awal dari data yang sudah ada.
export function buildSeedLog() {
  const entries = [];

  PLATFORM_USERS.filter((u) => u.verification === "terverifikasi" && u.verifiedBy).forEach((u) => {
    entries.push({
      id: `seed-ver-${u.id}`, seq: 0, at: `${u.verifiedAt}T09:00`,
      adminId: u.verifiedBy, adminName: adminName(u.verifiedBy),
      category: "verifikasi", action: "approve",
      summary: `Menyetujui verifikasi ${u.name}`,
      refs: { userId: u.id }, meta: { joinedAt: u.joinedAt }, seed: true,
    });
  });

  REPORTS.forEach((r) => {
    r.actions.forEach((a, i) => {
      entries.push({
        id: `seed-rep-${r.id}-${i}`, seq: 0, at: `${a.date}T10:0${i}`,
        adminId: a.adminId, adminName: adminName(a.adminId),
        category: "laporan", action: a.txId ? "bekukan" : "tindakan",
        summary: a.note,
        refs: { reportId: r.id, projectId: r.projectId, ...(a.txId ? { txId: a.txId } : {}) },
        meta: { openedAt: r.openedAt }, seed: true,
      });
    });
  });

  return entries;
}

// Terbaru di atas; `seq` memecah seri kalau waktunya sama.
export const sortLogDesc = (entries) => [...entries].sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq);

// --- Selektor: turunan dari log, dipakai fitur lain -----------------------

// Aksi dana manual (bentuk lama EscrowContext) — dipakai fundStatusOfTerm().
export function escrowActions(entries) {
  return entries
    .filter((e) => e.category === "escrow" && !e.seed)
    .map((e) => ({ txId: e.refs.txId, action: e.action, by: e.adminName, adminId: e.adminId, reason: e.meta.reason, at: e.at }));
}

// { [userId]: { action: "approve" | "reject", reason, adminId, at } } — keputusan
// verifikasi yang diambil di sesi ini.
export function verificationDecisions(entries) {
  const out = {};
  entries
    .filter((e) => e.category === "verifikasi" && !e.seed)
    .sort((a, b) => a.at.localeCompare(b.at) || a.seq - b.seq)
    .forEach((e) => { out[e.refs.userId] = { action: e.action, reason: e.meta.reason || null, adminId: e.adminId, at: e.at }; });
  return out;
}

// Laporan dengan status & riwayat tindakan TERKINI: data bawaan + perubahan
// yang dicatat di log sesi ini. Menambahkan ID pelapor/terlapor eksplisit.
export function effectiveReports(entries) {
  const runtime = entries
    .filter((e) => e.category === "laporan" && !e.seed)
    .sort((a, b) => a.at.localeCompare(b.at) || a.seq - b.seq);

  return REPORTS.map((r) => {
    const mine = runtime.filter((e) => e.refs.reportId === r.id);
    const reporterType = r.reportedBy; // "umkm" | "mahasiswa"
    const againstType = reporterType === "umkm" ? "mahasiswa" : "umkm";
    const base = {
      ...r,
      reporterId: userIdFor(reporterType, r.reporterName),
      againstId: userIdFor(againstType, r.against),
    };
    if (mine.length === 0) return base;
    const last = mine[mine.length - 1];
    return {
      ...base,
      status: last.meta.status || r.status,
      handledBy: last.adminId,
      actions: [
        ...r.actions,
        ...mine.map((e) => ({ date: e.at.slice(0, 10), by: e.adminName, adminId: e.adminId, note: e.meta.note })),
      ],
    };
  });
}

// Tujuan klik sebuah entri: halaman detail entitas yang disentuh.
export function entryHref(e) {
  if (e.refs.reportId) return `/reports?report=${e.refs.reportId}`;
  if (e.refs.txId) return `/escrow?tx=${e.refs.txId}`;
  if (e.refs.userId) return `/users?user=${e.refs.userId}`;
  return null;
}
