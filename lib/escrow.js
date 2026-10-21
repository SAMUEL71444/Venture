// Status dana escrow — SATU fungsi (fundStatusOfTerm) dipakai oleh Penghasilan
// (Nadia), Proyek Saya (UMKM), dan Transaksi & Dana (Verify & Trust), supaya
// transaksi yang sama selalu kelihatan sama persis di ketiga sisi. Tidak ada
// status yang ditulis manual per role.
import { PAYOUT_DAYS } from "./earnings.mock";
import { PAYMENT_TERMS } from "./transactions.mock";
import { userIdFor, mahasiswaIdOf } from "./directory";

export const FUND_STATUS = {
  ditahan: { label: "Ditahan", badgeClass: "badge-warning", icon: "lock" },
  diproses: { label: "Diproses Pencairan", badgeClass: "badge-info", icon: "clock" },
  dicairkan: { label: "Dicairkan", badgeClass: "badge-success", icon: "checkCircle" },
  dibekukan: { label: "Dibekukan", badgeClass: "badge-error", icon: "shield" },
  dikembalikan: { label: "Dikembalikan", badgeClass: "badge-neutral", icon: "rotate" },
};

const DAY = 24 * 60 * 60 * 1000;

function txId(term) {
  return `${term.projectId}-${term.milestoneId}`;
}

// `actions`: log audit aksi manual Verify & Trust, [{txId, action: "cairkan"
// | "bekukan" | "kembalikan", by, at, reason}] — aksi TERBARU per txId selalu
// menang atas hasil hitungan otomatis di bawah.
// `frozenProjectIds`: Set id proyek yang punya laporan aktif (lihat
// lib/reports.mock.js, activeReportProjectIds()) — HANYA membekukan termin
// yang belum cair (status alaminya "ditahan"); termin yang sudah disetujui &
// dibayar sebelum laporan masuk tidak ikut dibekukan retroaktif.
export function fundStatusOfTerm(term, project, today, { actions = [], frozenProjectIds = new Set() } = {}) {
  const id = txId(term);
  const lastAction = actions
    .filter((a) => a.txId === id)
    .sort((a, b) => a.at.localeCompare(b.at))
    .pop();
  if (lastAction) {
    if (lastAction.action === "bekukan") return "dibekukan";
    if (lastAction.action === "cairkan") return "dicairkan";
    if (lastAction.action === "kembalikan") return "dikembalikan";
  }

  const events = project.events
    .filter((e) => e.milestone === term.milestoneId)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const approved = events.find((e) => e.type === "disetujui");

  if (project.status === "dibatalkan" && !approved) return "dikembalikan";

  if (approved) {
    const days = Math.round((new Date(today) - new Date(approved.date)) / DAY);
    return days <= PAYOUT_DAYS ? "diproses" : "dicairkan";
  }

  // Belum disetujui sama sekali -> "ditahan" secara alami. Kalau proyeknya
  // sedang punya laporan aktif, statusnya naik jadi "dibekukan".
  return frozenProjectIds.has(project.id) ? "dibekukan" : "ditahan";
}

// Satu baris per termin, lintas freelancer — dipakai /escrow (Verify &
// Trust) dan jadi DASAR baris Pembayaran (UMKM) & Penghasilan (Mahasiswa).
// `projects` idealnya hasil getPlatformProjects() supaya `freelancerName`
// dan ID pihak ikut ke-enrich. Setiap baris memuat relasi eksplisit:
// projectId, umkmId, mahasiswaId, dan lastAdminId/lastAction (aksi manual
// admin terakhir pada termin itu, dari `opts.actions`, kalau ada).
export function buildEscrowTransactions(projects, terms, today, opts = {}) {
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const lastActionOf = (id) => (opts.actions || [])
    .filter((a) => a.txId === id)
    .sort((a, b) => a.at.localeCompare(b.at))
    .pop();

  return terms.map((t) => {
    const project = byId[t.projectId];
    if (!project) return null;
    const milestoneIdx = project.milestones.findIndex((m) => m.id === t.milestoneId);
    const milestone = project.milestones[milestoneIdx];
    const events = project.events
      .filter((e) => e.milestone === t.milestoneId)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const approved = events.find((e) => e.type === "disetujui");
    const last = events[events.length - 1];
    const date = approved?.date || last?.date || project.startDate;
    const amount = Math.round(project.budget * t.persen);
    const status = fundStatusOfTerm(t, project, today, opts);

    const lastAct = lastActionOf(txId(t));

    return {
      id: txId(t),
      projectId: project.id,
      projectTitle: project.title,
      client: project.client,
      umkmId: project.umkmId || userIdFor("umkm", project.client),
      freelancerName: project.freelancerName || "Nadia Putri",
      mahasiswaId: project.mahasiswaId || mahasiswaIdOf(project.freelancerId),
      lastAdminId: lastAct?.adminId || null,
      lastAction: lastAct?.action || null,
      milestoneIndex: milestoneIdx + 1,
      milestoneName: milestone?.name,
      persen: t.persen,
      amount,
      metode: t.metode,
      date,
      status,
    };
  }).filter(Boolean);
}

// Semua jadwal termin platform (punya Nadia + freelancer lain), dan versi
// yang disaring buat satu proyek — dipakai komponen "Dana per milestone" di
// ProjectDetailDrawer (dilihat dari sisi UMKM).
export function allPaymentTerms() {
  return PAYMENT_TERMS;
}

export function termsForProject(projectId) {
  return allPaymentTerms().filter((t) => t.projectId === projectId);
}
