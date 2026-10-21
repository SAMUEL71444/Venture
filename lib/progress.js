// Perhitungan progress proyek + histori, tanpa React. Sumber kebenarannya
// adalah log event per proyek (lihat lib/projects.mock.js): status milestone,
// daftar file terkirim, dan angka "sebelum -> sesudah" di histori semuanya
// dihitung ulang dengan memutar ulang event, jadi tidak ada angka progress
// yang diketik manual dan kartu/drawer/histori pasti konsisten.

export const PROGRESS_WEIGHTS = {
  milestone: 50, // milestone disetujui klien / total milestone
  file: 20,      // file terkirim / file diminta
  review: 20,    // rata-rata skor review klien per milestone
  waktu: 10,     // hari berjalan / durasi proyek (indikator tambahan)
};

// Skor review per status milestone: sudah disetujui paling tinggi, sudah
// dikirim & menunggu review setengah, sudah direview tapi minta revisi
// seperempat, belum dikirim nol.
const REVIEW_SCORE = { disetujui: 1, selesai: 0.5, revisi: 0.25, berjalan: 0, belum: 0 };

const DAY = 24 * 60 * 60 * 1000;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

// Nilai tiap komponen dalam poin (sudah dikali bobot), mis. { milestone: 25, ... }.
export function getProgressBreakdown({ milestones, deliverables, deliverablesRequired, startDate, deadline }, asOf) {
  const total = milestones.length || 1;
  const approved = milestones.filter((m) => m.status === "disetujui").length;
  const allApproved = milestones.length > 0 && approved === milestones.length;

  const milestoneRatio = approved / total;
  const fileRatio = deliverablesRequired ? clamp01(deliverables.length / deliverablesRequired) : 0;
  const reviewRatio = milestones.reduce((sum, m) => sum + (REVIEW_SCORE[m.status] ?? 0), 0) / total;
  const duration = new Date(deadline) - new Date(startDate);
  const timeRatio = allApproved ? 1 : duration > 0 ? clamp01((new Date(asOf) - new Date(startDate)) / duration) : 0;

  return {
    milestone: milestoneRatio * PROGRESS_WEIGHTS.milestone,
    file: fileRatio * PROGRESS_WEIGHTS.file,
    review: reviewRatio * PROGRESS_WEIGHTS.review,
    waktu: timeRatio * PROGRESS_WEIGHTS.waktu,
  };
}

// Persentase progress 0–100 dari data milestone, file, review, dan tanggal.
export function calculateProjectProgress(state, asOf) {
  const b = getProgressBreakdown(state, asOf);
  return Math.round(b.milestone + b.file + b.review + b.waktu);
}

function sortedEvents(project) {
  return project.events
    .map((e, i) => ({ ...e, _i: i }))
    .sort((a, b) => a.date.localeCompare(b.date) || a._i - b._i);
}

// Putar ulang `events` (sudah terurut) -> status milestone + file terkirim.
function replay(project, events) {
  const status = Object.fromEntries(project.milestones.map((m) => [m.id, "belum"]));
  const deliverables = [];
  for (const e of events) {
    if (e.type === "upload") deliverables.push({ file: e.file, date: e.date });
    else if (e.type === "mulai") status[e.milestone] = "berjalan";
    else if (e.type === "kirim") status[e.milestone] = "selesai";
    else if (e.type === "revisi") status[e.milestone] = "revisi";
    else if (e.type === "disetujui") status[e.milestone] = "disetujui";
  }
  return {
    milestones: project.milestones.map((m) => ({ ...m, status: status[m.id] })),
    deliverables,
    deliverablesRequired: project.deliverablesRequired,
    startDate: project.startDate,
    deadline: project.deadline,
  };
}

export function replayEvents(project, untilDate) {
  return replay(project, sortedEvents(project).filter((e) => e.date <= untilDate));
}

const EVENT_META = {
  mulai: { icon: "activity", tone: "primary" },
  upload: { icon: "upload", tone: "info" },
  kirim: { icon: "send", tone: "warning" },
  revisi: { icon: "rotate", tone: "danger" },
  disetujui: { icon: "checkCircle", tone: "success" },
  batal: { icon: "xCircle", tone: "neutral" },
};

function describe(project, e) {
  const idx = project.milestones.findIndex((m) => m.id === e.milestone);
  const ms = idx >= 0 ? `Milestone ${idx + 1}: ${project.milestones[idx].name}` : "";
  switch (e.type) {
    case "mulai": return `Mulai mengerjakan ${ms}`;
    case "upload": return `File ${e.file} diunggah`;
    case "kirim": return `${ms} dikirim, menunggu review klien`;
    case "revisi": return `Klien minta revisi ${ms}${e.note ? ` — "${e.note}"` : ""}`;
    case "disetujui": return `${ms} disetujui klien`;
    case "batal": return `Proyek dibatalkan klien${e.note ? ` — ${e.note}` : ""}`;
    default: return e.type;
  }
}

// Proyek + field turunan: milestones (dengan status), deliverables, progress,
// breakdown, updatedAt, dan history (terbaru di atas). Proyek dibatalkan
// dihitung sampai tanggal batal supaya angkanya "terhenti".
export function enrichProject(project, asOf) {
  const events = sortedEvents(project).filter((e) => e.date <= asOf);
  const lastDate = events.length ? events[events.length - 1].date : project.startDate;
  const effectiveAsOf = project.status === "dibatalkan" ? lastDate : asOf;

  const state = replay(project, events);
  const history = events.map((e, i) => ({
    date: e.date,
    type: e.type,
    desc: describe(project, e),
    ...EVENT_META[e.type],
    // "sebelum" & "sesudah" dihitung di tanggal event yang sama, jadi
    // selisihnya murni karena event itu, bukan karena waktu berjalan.
    before: calculateProjectProgress(replay(project, events.slice(0, i)), e.date),
    after: calculateProjectProgress(replay(project, events.slice(0, i + 1)), e.date),
  })).reverse();

  return {
    ...project,
    milestones: state.milestones,
    deliverables: state.deliverables,
    progress: calculateProjectProgress(state, effectiveAsOf),
    breakdown: getProgressBreakdown(state, effectiveAsOf),
    updatedAt: lastDate,
    history,
  };
}
