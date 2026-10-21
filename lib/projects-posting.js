// Fungsi murni untuk fitur "Posting Proyek" (UMKM): bentuk draft, validasi,
// membangun proyek yang diposting, dan aturan KUNCI milestone. Tidak ada
// React di sini — state-nya dipegang context/ProjectsContext.js.
import { PROJECTS } from "./mock-data";
import { TALENTS } from "./talents.mock";
import { termsForProject } from "./escrow";

export const PRICE_TYPES = ["Harga Tetap", "Per Jam"];

// Kategori & skill diambil dari data yang sudah ada (proyek + talent), bukan
// daftar baru, supaya pilihan di form sama dengan yang dipakai pencarian.
export const CATEGORIES = [...new Set([...PROJECTS.map((p) => p.category), ...TALENTS.map((t) => t.category)])];
export const SKILL_OPTIONS = [...new Set(TALENTS.flatMap((t) => t.skills.map((s) => s.name)))].sort((a, b) => a.localeCompare(b, "id"));

let counter = 0;
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`;

// Nominal disimpan sebagai string di form (input), dikonversi saat validasi.
export function newMilestone() {
  return { id: uid("ms"), name: "", description: "", amount: "", deadline: "" };
}

export function emptyDraft() {
  return {
    title: "", category: CATEGORIES[0], description: "", skills: [],
    priceType: PRICE_TYPES[0], milestones: [newMilestone()],
  };
}

// `requireAmount` false = milestone proyek bawaan (nominalnya dikunci oleh
// jadwal escrow, jadi tidak diedit/diisi di sini). `requireDeadline` false =
// tenggat boleh kosong (milestone bawaan memang belum punya tenggat sendiri),
// tapi kalau diisi tetap tidak boleh di masa lalu.
export function validateMilestone(m, today, { requireAmount = true, requireDeadline = true } = {}) {
  const errors = {};
  if (!m.name?.trim()) errors.name = "Nama milestone wajib diisi.";
  if (requireAmount && !(Number(m.amount) > 0)) errors.amount = "Nominal harus lebih dari 0.";
  if (!m.deadline) {
    if (requireDeadline) errors.deadline = "Tenggat wajib diisi.";
  } else if (m.deadline < today) errors.deadline = "Tenggat tidak boleh di masa lalu.";
  return errors;
}

// Validasi minimum sebelum "Posting Proyek" bisa ditekan: judul terisi,
// minimal 1 milestone, tiap milestone bernama + nominal > 0 + tenggat valid.
export function validateDraft(draft, today) {
  const titleError = draft.title.trim() ? null : "Judul proyek wajib diisi.";
  const milestoneErrors = {};
  draft.milestones.forEach((m) => {
    const e = validateMilestone(m, today);
    if (Object.keys(e).length) milestoneErrors[m.id] = e;
  });
  const milestonesError = draft.milestones.length === 0 ? "Minimal ada 1 milestone." : null;
  const step1Ok = !titleError;
  const step2Ok = !milestonesError && Object.keys(milestoneErrors).length === 0;
  return { titleError, milestoneErrors, milestonesError, step1Ok, step2Ok, ok: step1Ok && step2Ok };
}

export const sumAmounts = (milestones) => milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0);
const maxDeadline = (milestones) => milestones.reduce((max, m) => (m.deadline && m.deadline > max ? m.deadline : max), "");

// Proyek mentah (belum di-enrich) siap disimpan. Statusnya "terbuka" —
// status yang sudah ada di STATUS_META (lib/projects.mock.js) untuk proyek
// yang menunggu freelancer. Belum punya jadwal escrow, jadi tidak
// menyentuh angka Pembayaran/Penghasilan/Verify & Trust.
export function buildPostedProject(draft, umkmName, today) {
  const milestones = draft.milestones.map((m) => ({
    id: m.id, name: m.name.trim(), description: (m.description || "").trim(),
    amount: Number(m.amount), deadline: m.deadline,
  }));
  return {
    id: uid("up"),
    title: draft.title.trim(),
    client: umkmName,
    category: draft.category,
    status: "terbuka",
    priceType: draft.priceType,
    skills: draft.skills,
    description: draft.description.trim() || "Belum ada deskripsi.",
    budget: sumAmounts(milestones),
    startDate: today,
    deadline: maxDeadline(milestones),
    location: "Remote",
    freelancerId: null,
    freelancerName: null,
    events: [],
    deliverablesRequired: 0,
    milestones,
    milestoneBudget: true, // nominal milestone ikut membentuk anggaran
    posted: true,
  };
}

// Setelah milestone proyek yang diposting diedit: anggaran & tenggat proyek
// dihitung ulang dari milestone-nya.
export function applyPostedMilestones(project, milestones) {
  return { ...project, milestones, budget: sumAmounts(milestones), deadline: maxDeadline(milestones) || project.deadline };
}

const LOCK_BY_STATUS = {
  disetujui: "Sudah disetujui",
  selesai: "Sudah dikirim, menunggu review",
  revisi: "Sedang direvisi",
  berjalan: "Sedang berjalan",
};

// null = milestone ini masih bebas diedit/dihapus. Selain itu alasan kunci.
// Dijaga ketat supaya struktur escrow tidak rusak: milestone yang sudah
// berjalan/disetujui ATAU dananya sudah dijadwalkan di escrow tidak boleh
// diubah, dan proyek yang sudah selesai/dibatalkan tidak bisa diubah sama
// sekali.
export function milestoneLock(project, milestone) {
  if (project.status === "selesai") return "Proyek sudah selesai";
  if (project.status === "dibatalkan") return "Proyek dibatalkan";
  if (LOCK_BY_STATUS[milestone.status]) return LOCK_BY_STATUS[milestone.status];
  if (termsForProject(project.id).some((t) => t.milestoneId === milestone.id)) return "Dana sudah dijadwalkan di escrow";
  return null;
}

export const canAddMilestone = (project) => project.status !== "selesai" && project.status !== "dibatalkan";
// Nominal milestone cuma bisa diedit di proyek yang diposting lewat form;
// proyek bawaan anggarannya dikunci oleh jadwal escrow.
export const editsAmount = (project) => !!project.milestoneBudget;
