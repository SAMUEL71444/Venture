// Turunan halaman "Pembayaran" UMKM. Baris transaksinya diambil dari sumber
// tunggal getAllTransactions() (lib/transactions.js) — SAMA dengan Transaksi &
// Dana (Verify & Trust) dan Penghasilan (Mahasiswa) — lalu disaring ke milik
// UMKM yang login lewat umkmId (bukan lagi nama). Jadi status dana dan nilai
// termin tidak pernah ditulis ulang di sini; yang ditambahkan cuma framing
// UMKM: biaya layanan, total yang dibayar, dan metode pembayaran.
import { monthlyIncome } from "./earnings";
import { getAllTransactions, forUmkm } from "./transactions";
import { userIdFor } from "./directory";
import { getPlatformProjects } from "./platform-projects.mock";
import { getAllProjects } from "./projects.mock";
import { UMKM_SERVICE_FEE, PAYMENT_METHODS, PAYMENT_SOURCE, DEPOSIT_TOPUPS } from "./payments.mock";

export function umkmProjects(umkmName) {
  const umkmId = userIdFor("umkm", umkmName);
  return getPlatformProjects(getAllProjects()).filter((p) => p.umkmId === umkmId);
}

function noteFor(status, lastType, milestoneIndex) {
  if (status === "diproses") return "Sedang dicairkan ke mahasiswa, selesai dalam 1×24 jam.";
  if (status === "dibekukan") return "Dibekukan sementara — ada laporan aktif yang sedang ditinjau Verify & Trust.";
  if (status === "dikembalikan") return "Proyek dibatalkan sebelum milestone disetujui — dana dikembalikan ke metode pembayaranmu.";
  if (status !== "ditahan") return null;
  if (lastType === "kirim") return `Menunggu persetujuanmu — Milestone ${milestoneIndex} sudah dikirim mahasiswa.`;
  if (lastType === "revisi") return `Kamu meminta revisi Milestone ${milestoneIndex}, menunggu kiriman ulang.`;
  return `Milestone ${milestoneIndex} belum dikirim mahasiswa — dana aman di escrow.`;
}

// `actions` = log aksi manual Verify & Trust (EscrowContext), supaya
// pembekuan/pencairan manual juga langsung terlihat di sini.
export function buildPayments(umkmName, today, { actions = [] } = {}) {
  const projects = getPlatformProjects(getAllProjects());
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));

  return forUmkm(getAllTransactions({ actions, today }), userIdFor("umkm", umkmName))
    .map((tx) => {
      const project = byId[tx.projectId];
      const milestoneId = tx.id.slice(tx.projectId.length + 1);
      const events = project.events.filter((e) => e.milestone === milestoneId);
      const lastType = events[events.length - 1]?.type;
      const methodId = PAYMENT_SOURCE[tx.id] || "va-bca";
      const fee = Math.round(tx.amount * UMKM_SERVICE_FEE);
      return {
        ...tx,
        projectStatus: project.status,
        fee,
        totalPaid: tx.amount + fee,
        methodId,
        methodLabel: PAYMENT_METHODS.find((m) => m.id === methodId)?.label || methodId,
        needsReview: tx.status === "ditahan" && lastType === "kirim",
        note: noteFor(tx.status, lastType, tx.milestoneIndex),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

const RELEASED = (p) => p.status === "dicairkan" || p.status === "diproses";
const HELD = (p) => p.status === "ditahan" || p.status === "dibekukan";

export function summarizePayments(payments) {
  const sum = (list, key) => list.reduce((s, p) => s + p[key], 0);

  // Proyek "lunas" = proyeknya selesai DAN semua terminnya sudah dicairkan.
  const byProject = new Map();
  payments.forEach((p) => {
    if (!byProject.has(p.projectId)) byProject.set(p.projectId, []);
    byProject.get(p.projectId).push(p);
  });
  const paidOff = [...byProject.values()].filter((items) => items[0].projectStatus === "selesai" && items.every((p) => p.status === "dicairkan"));
  const paidOffTotal = paidOff.reduce((s, items) => s + sum(items, "totalPaid"), 0);

  const depositSpent = sum(payments.filter((p) => p.methodId === "deposit" && p.status !== "dikembalikan"), "totalPaid");

  return {
    totalPengeluaran: sum(payments.filter(RELEASED), "totalPaid"),
    // Nilai termin (tanpa biaya layanan) — angka yang sama dengan yang
    // dilihat Verify & Trust & mahasiswa sebagai "dana tertahan".
    danaTertahan: sum(payments.filter(HELD), "amount"),
    saldoDeposit: sum(DEPOSIT_TOPUPS, "amount") - depositSpent,
    proyekLunas: paidOff.length,
    rataRataPerProyek: paidOff.length ? Math.round(paidOffTotal / paidOff.length) : 0,
  };
}

// Pakai ulang monthlyIncome() milik Penghasilan — bedanya yang dijumlah
// adalah total yang dibayar UMKM, bukan penghasilan bersih mahasiswa.
export function monthlySpending(payments, today, months = 6) {
  return monthlyIncome(payments.map((p) => ({ ...p, net: p.totalPaid })), today, months);
}

// Satu faktur per proyek. Termin yang dikembalikan tidak ditagihkan, dan
// proyek yang seluruh terminnya dikembalikan tidak punya faktur.
export function buildPaymentInvoices(payments) {
  const byProject = new Map();
  payments.filter((p) => p.status !== "dikembalikan").forEach((p) => {
    if (!byProject.has(p.projectId)) byProject.set(p.projectId, []);
    byProject.get(p.projectId).push(p);
  });

  return [...byProject.entries()]
    .map(([projectId, items]) => {
      const date = items.reduce((max, p) => (p.date > max ? p.date : max), items[0].date);
      const subtotal = items.reduce((s, p) => s + p.amount, 0);
      const fee = items.reduce((s, p) => s + p.fee, 0);
      const status = items.every((p) => p.status === "dicairkan") ? "lunas" : items.some(RELEASED) ? "sebagian" : "menunggu";
      return {
        id: `pinv-${projectId}`,
        projectId,
        projectTitle: items[0].projectTitle,
        client: items[0].client,
        freelancerName: items[0].freelancerName,
        date,
        items: [...items].sort((a, b) => a.milestoneIndex - b.milestoneIndex),
        subtotal, fee, total: subtotal + fee,
        status,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((inv, i, all) => ({ ...inv, number: `INV/UMKM/${inv.date.slice(0, 7).replace("-", "/")}/${String(all.length - i).padStart(4, "0")}` }));
}
