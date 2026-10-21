// Turunan dari sumber transaksi tunggal (termin di lib/transactions.mock.js +
// data proyek di lib/projects.mock.js) — status, tanggal, dan jumlah tiap
// transaksi dihitung lib/escrow.js, bukan diketik manual, jadi selalu
// konsisten dengan histori progres proyek dan dengan sudut pandang UMKM &
// Verify & Trust.
import { PLATFORM_FEE } from "./earnings.mock";
import { FUND_STATUS, buildEscrowTransactions, allPaymentTerms } from "./escrow";
import { activeReportProjectIds } from "./reports.mock";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Badge transaksi sekarang langsung status escrow 5-status (ditahan/
// diproses/dicairkan/dibekukan/dikembalikan) dari lib/escrow.js — SATU
// sumber, biar status yang tampil di Penghasilan (Nadia) sama persis dengan
// yang dilihat UMKM (Proyek Saya) dan Verify & Trust (Transaksi & Dana).
export const TX_STATUS_META = FUND_STATUS;

export const WD_STATUS_META = {
  berhasil: { label: "Berhasil", badgeClass: "badge-success", icon: "checkCircle" },
  diproses: { label: "Diproses", badgeClass: "badge-warning", icon: "clock" },
  gagal: { label: "Gagal", badgeClass: "badge-error", icon: "xCircle" },
};

export const INVOICE_STATUS_META = {
  lunas: { label: "Lunas", badgeClass: "badge-success" },
  sebagian: { label: "Sebagian", badgeClass: "badge-warning" },
  menunggu: { label: "Menunggu", badgeClass: "badge-neutral" },
};

// Satu baris per termin pembayaran yang sudah punya kejadian ("kirim" /
// "revisi" / "disetujui") di log event proyek. Termin yang milestone-nya
// belum sama sekali dikirim tidak menghasilkan transaksi. `status` dihitung
// fundStatusOfTerm() (lib/escrow.js) — sama seperti yang dilihat UMKM/Verify
// & Trust untuk termin yang sama. Barisnya diproyeksikan dari
// buildEscrowTransactions() — pembangun dasar yang sama dengan Pembayaran
// (UMKM) dan Transaksi & Dana (Verify & Trust) — disaring ke `projects` yang
// dikirim (proyek Nadia sendiri); di sini cuma ditambah framing penghasilan
// (biaya platform 10%, bersih) dan catatan status. ID baris = ID transaksi
// bersama (`projectId-milestoneId`).
export function buildTransactions(projects, today) {
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const frozenProjectIds = activeReportProjectIds();

  return buildEscrowTransactions(projects, allPaymentTerms(), today, { frozenProjectIds }).map((tx) => {
    const project = byId[tx.projectId];
    const milestoneId = tx.id.slice(tx.projectId.length + 1);
    const events = project.events
      .filter((e) => e.milestone === milestoneId)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const approved = events.find((e) => e.type === "disetujui");
    const last = events[events.length - 1];
    // Termin cuma jadi baris penghasilan begitu minimal sudah "kirim" sekali
    // (atau langsung disetujui) — milestone yang baru "mulai" belum dianggap
    // transaksi.
    const hasActivity = !!approved || last?.type === "revisi" || last?.type === "kirim";
    if (!hasActivity) return null;

    const status = tx.status;
    let note = null;
    if (status === "diproses") note = "Sedang dicairkan ke saldo, diperkirakan masuk dalam 1x24 jam.";
    else if (status === "dibekukan") note = "Dana dibekukan sementara — ada laporan aktif pada proyek ini, menunggu keputusan Verify & Trust.";
    else if (status === "dikembalikan") note = "Proyek dibatalkan sebelum milestone ini disetujui, dana dikembalikan ke klien.";
    else if (status === "ditahan" && last.type === "revisi") note = `Klien meminta revisi Milestone ${tx.milestoneIndex}: ${tx.milestoneName}`;
    else if (status === "ditahan" && last.type === "kirim") note = `Menunggu klien menyetujui Milestone ${tx.milestoneIndex}: ${tx.milestoneName}`;

    const gross = tx.amount;
    const fee = Math.round(gross * PLATFORM_FEE);

    return {
      id: tx.id,
      projectId: tx.projectId,
      projectTitle: tx.projectTitle,
      client: tx.client,
      umkmId: tx.umkmId,
      mahasiswaId: tx.mahasiswaId,
      milestoneIndex: tx.milestoneIndex,
      milestoneName: tx.milestoneName,
      persen: tx.persen,
      metode: tx.metode,
      gross, fee, net: gross - fee,
      status, date: tx.date, note,
    };
  }).filter(Boolean);
}

// Satu faktur per proyek yang sudah punya minimal satu transaksi.
export function buildInvoices(transactions, projects) {
  const byProject = new Map();
  transactions.forEach((tx) => {
    if (!byProject.has(tx.projectId)) byProject.set(tx.projectId, []);
    byProject.get(tx.projectId).push(tx);
  });

  return [...byProject.entries()].map(([projectId, items], i) => {
    const project = projects.find((p) => p.id === projectId);
    const subtotal = items.reduce((s, t) => s + t.gross, 0);
    const fee = items.reduce((s, t) => s + t.fee, 0);
    const released = items.some((t) => t.status === "dicairkan" || t.status === "diproses");
    const allDone = items.every((t) => t.status === "dicairkan");
    const status = allDone ? "lunas" : released ? "sebagian" : "menunggu";
    const date = items.reduce((max, t) => (t.date > max ? t.date : max), items[0].date);

    return {
      id: `inv-${projectId}`,
      number: `INV/${date.slice(0, 7).replace("-", "/")}/${String(i + 1).padStart(4, "0")}`,
      projectId,
      projectTitle: project.title,
      client: project.client,
      date,
      items,
      subtotal,
      fee,
      net: subtotal - fee,
      status,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export function summarize(transactions, withdrawals) {
  const netOf = (list) => list.reduce((s, t) => s + t.net, 0);
  const dicairkan = transactions.filter((t) => t.status === "dicairkan");
  const diproses = transactions.filter((t) => t.status === "diproses");
  // "Dana Tertahan (Escrow)" = belum cair ke saldo sama sekali, entah masih
  // nunggu approval klien ATAU sedang dibekukan karena laporan aktif.
  // "dikembalikan" SENGAJA tidak dihitung di mana pun di sini — dana itu
  // balik ke klien, bukan bagian penghasilan Nadia.
  const tertahan = transactions.filter((t) => t.status === "ditahan" || t.status === "dibekukan");

  const totalDitarik = withdrawals.filter((w) => w.status === "berhasil").reduce((s, w) => s + w.amount, 0);
  const penarikanDiproses = withdrawals.filter((w) => w.status === "diproses").reduce((s, w) => s + w.amount, 0);

  return {
    totalPenghasilan: netOf(dicairkan) + netOf(diproses),
    saldoTertahan: netOf(tertahan),
    totalDitarik,
    saldoTersedia: netOf(dicairkan) - totalDitarik - penarikanDiproses,
  };
}

// 6 bulan terakhir (berakhir di bulan `today`), total penghasilan yang
// sudah/sedang dicairkan (selesai + diproses) per bulan berdasarkan tanggal
// milestone disetujui.
export function monthlyIncome(transactions, today, months = 6) {
  const end = new Date(today);
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, label: MONTH_LABELS[d.getMonth()], total: 0 });
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  transactions
    .filter((t) => t.status === "dicairkan" || t.status === "diproses")
    .forEach((t) => {
      const bucket = byKey[t.date.slice(0, 7)];
      if (bucket) bucket.total += t.net;
    });
  return buckets;
}
