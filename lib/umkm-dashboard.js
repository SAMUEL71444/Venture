// Turunan dashboard UMKM. Proyek & dana diambil dari sumber yang SAMA
// dengan halaman Proyek dan Pembayaran (lib/payments.js -> lib/escrow.js),
// bukan angka yang diketik ulang, jadi dashboard tidak pernah bertentangan
// dengan halaman lain.
import { buildPayments, summarizePayments } from "./payments";
import { TALENTS } from "./talents.mock";
import { MOCK_TODAY } from "./projects.mock";
import { sisaHari } from "./format";

const ACTIVE = ["berjalan", "menunggu_review", "revisi"];

// `projects` = daftar proyek UMKM dari useClientProjects() (proyek yang
// diposting + proyek bawaan, sudah termasuk hasil edit milestone). Dana
// (`payments`) tetap dari escrow bawaan — proyek yang baru diposting belum
// punya jadwal escrow. `hasProjects: false` = skenario "UMKM baru": dana
// bawaan disembunyikan, tapi proyek yang diposting tetap dihitung.
export function dashboardData(umkmName, { projects = [], actions = [], hasProjects = true } = {}) {
  const payments = hasProjects ? buildPayments(umkmName, MOCK_TODAY, { actions }) : [];
  const active = projects
    .filter((p) => ACTIVE.includes(p.status))
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const open = projects.filter((p) => p.status === "terbuka");
  const summary = summarizePayments(payments);
  const next = active[0] ? { title: active[0].title, ...sisaHari(active[0].deadline, MOCK_TODAY) } : null;

  return {
    projects, active, open, payments,
    activeCount: active.length,
    openCount: open.length,
    danaTertahan: summary.danaTertahan,
    totalPengeluaran: summary.totalPengeluaran,
    nextDeadline: next,
    waitingApproval: payments.filter((p) => p.needsReview).length,
  };
}

// Rekomendasi talent: skor dari kecocokan kategori/skill dengan proyek yang
// pernah/sedang dikerjakan UMKM ini, lalu tingkat keberhasilan sebagai
// pembeda. UMKM tanpa riwayat diurutkan dari tingkat keberhasilan & rating.
// `worked` = talent yang pernah dipakai (ditandai di kartu, bukan disaring).
export function recommendTalents(projects, limit = 8) {
  const categories = [...new Set(projects.map((p) => p.category))];
  const haystack = projects.map((p) => `${p.title} ${p.description || ""}`.toLowerCase()).join(" ");
  const workedIds = new Set(projects.map((p) => p.freelancerId).filter(Boolean));

  return TALENTS
    .map((t) => {
      const categoryMatch = categories.includes(t.category);
      const skillHits = t.skills.filter((s) => haystack.includes(s.name.toLowerCase())).length;
      const score = (categoryMatch ? 3 : 0) + Math.min(skillHits, 2) + t.successRate / 100 + t.rating / 10;
      let reason;
      if (categoryMatch) reason = `Cocok dengan proyek ${t.category}-mu`;
      else if (skillHits > 0) reason = "Skill-nya terpakai di proyekmu";
      else reason = `${t.successRate}% tingkat keberhasilan`;
      return { talent: t, score, reason, worked: workedIds.has(t.id) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
