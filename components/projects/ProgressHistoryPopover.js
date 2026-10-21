"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import Popover from "@/components/ui/Popover";
import { PROGRESS_WEIGHTS } from "@/lib/progress";
import { MOCK_TODAY } from "@/lib/projects.mock";
import { formatTanggal } from "@/lib/format";

const COMPONENTS = [
  { key: "milestone", label: "Milestone Disetujui" },
  { key: "file", label: "File Terkirim" },
  { key: "review", label: "Review Klien" },
  { key: "waktu", label: "Waktu Berjalan" },
];

const fmt1 = (n) => Number(n.toFixed(1)).toLocaleString("id-ID");
const fmtPct = (ratio) => Number((ratio * 100).toFixed(1)).toLocaleString("id-ID");

// Kalimat "pencapaian" per komponen — dirakit dari data mentah yang sama
// yang dipakai lib/progress.js buat hitung breakdown, jadi nggak ada angka
// yang diketik manual di sini.
function achievementText(p, key, asOf) {
  const total = p.milestones.length || 1;
  if (key === "milestone") {
    const approved = p.milestones.filter((m) => m.status === "disetujui").length;
    return `${approved} dari ${total} milestone disetujui = ${fmtPct(approved / total)}% tercapai`;
  }
  if (key === "file") {
    const req = p.deliverablesRequired || 0;
    const ratio = req ? Math.min(1, p.deliverables.length / req) : 0;
    return `${p.deliverables.length} dari ${req} file terkirim = ${fmtPct(ratio)}% tercapai`;
  }
  if (key === "review") {
    const groups = { disetujui: 0, menunggu: 0, revisi: 0, belum: 0 };
    p.milestones.forEach((m) => {
      if (m.status === "disetujui") groups.disetujui++;
      else if (m.status === "selesai") groups.menunggu++;
      else if (m.status === "revisi") groups.revisi++;
      else groups.belum++;
    });
    const ratio = p.breakdown.review / PROGRESS_WEIGHTS.review;
    return `Skor rata-rata ${fmt1(ratio)} (${groups.disetujui} disetujui, ${groups.menunggu} menunggu review, ${groups.revisi} revisi, ${groups.belum} belum dikirim)`;
  }
  // waktu
  const approved = p.milestones.filter((m) => m.status === "disetujui").length;
  if (p.milestones.length > 0 && approved === p.milestones.length) {
    return "Penuh — semua milestone disetujui";
  }
  const DAY = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(0, Math.round((new Date(p.deadline) - new Date(p.startDate)) / DAY));
  const elapsed = Math.min(totalDays, Math.max(0, Math.round((new Date(asOf) - new Date(p.startDate)) / DAY)));
  return `${elapsed} dari ${totalDays} hari berjalan`;
}

// Komponen terpisah (bukan arrow function inline) SENGAJA — kalau useState
// dipanggil langsung di dalam render-prop `children` milik Popover, hook itu
// kepasang ke fiber Popover, bukan komponen sendiri. Ditulis sebagai
// <HistoryPanel/> (elemen JSX asli), React kasih dia fiber & hook list
// independen, jadi tab-nya aman dipakai berulang di banyak popover sekaligus.
function HistoryPanel({ project: p }) {
  const [tab, setTab] = useState("timeline");
  const approved = p.milestones.filter((m) => m.status === "disetujui").length;
  const asOf = p.status === "dibatalkan" ? p.updatedAt : MOCK_TODAY;
  const totalPoints = Object.values(p.breakdown).reduce((s, v) => s + v, 0);

  return (
    <div className="history-panel" role="dialog" aria-label={`Histori progres ${p.title}`}>
      <div className="history-summary">
        <div>
          <div className="t-caption">PROGRES SAAT INI</div>
          <div className="history-big">{p.progress}%</div>
        </div>
        <div className="history-stats">
          <span><Icon name="checkCircle" /> Milestone <b>{approved} dari {p.milestones.length}</b> disetujui</span>
          <span><Icon name="paperclip" /> File <b>{p.deliverables.length} dari {p.deliverablesRequired}</b> terkirim</span>
        </div>
      </div>

      <div className="history-tabs" role="tablist">
        <button
          type="button" role="tab" aria-selected={tab === "timeline"}
          className={`history-tab ${tab === "timeline" ? "active" : ""}`}
          onClick={() => setTab("timeline")}
        >
          Timeline
        </button>
        <button
          type="button" role="tab" aria-selected={tab === "calc"}
          className={`history-tab ${tab === "calc" ? "active" : ""}`}
          onClick={() => setTab("calc")}
        >
          Rincian Perhitungan
        </button>
      </div>

      {/* Tinggi tetap (lihat CSS) supaya popover yang lagi kebuka ke atas
          (lihat components/ui/Popover.js) nggak "loncat" pas ganti tab. */}
      <div className="history-tab-body">
        {tab === "timeline" ? (
          <ol className="history-timeline">
            {p.history.map((h, i) => (
              <li key={i} className="history-event">
                <span className={`history-icon tone-${h.tone}`}><Icon name={h.icon} /></span>
                <div className="history-body">
                  <div className="t-small">{h.desc}</div>
                  <div className="history-meta">
                    <span>{formatTanggal(h.date)}</span>
                    {h.after !== h.before && (
                      <span className={`history-delta ${h.after > h.before ? "up" : "down"}`}>
                        {h.before}% → {h.after}%
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="calc-list">
            {COMPONENTS.map((c) => {
              const value = p.breakdown[c.key];
              const weight = PROGRESS_WEIGHTS[c.key];
              return (
                <div key={c.key} className="calc-row">
                  <div className="row-between">
                    <span className="t-small" style={{ fontWeight: 700 }}>{c.label}</span>
                    <span className="t-caption">Bobot {weight}%</span>
                  </div>
                  <p className="t-caption calc-achievement">{achievementText(p, c.key, asOf)}</p>
                  <div className="calc-track"><span style={{ width: `${Math.min(100, (value / weight) * 100)}%` }} /></div>
                  <div className="calc-contribution">Kontribusi: <b>{fmt1(value)}</b> dari {weight} poin</div>
                </div>
              );
            })}
            <div className="calc-total">
              <span>Total</span>
              <span>{fmt1(totalPoints)} poin → dibulatkan <b>{p.progress}%</b></span>
            </div>
            {p.status === "dibatalkan" && (
              <p className="t-caption mt-8">Dihitung sampai tanggal pembatalan ({formatTanggal(p.updatedAt)}).</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Progress bar (atau link kecil) yang membuka histori progres proyek.
// Datanya dari enrichProject() di lib/progress.js — angka di sini sama
// persis dengan yang tampil di kartu dan drawer.
// `variant="bar"` untuk proyek aktif, `"link"` untuk selesai/dibatalkan.
export default function ProgressHistoryPopover({ project: p, variant = "bar", label }) {
  return (
    <Popover
      panelClassName="popover-history"
      trigger={({ open, onClick }) => {
        const handleClick = (e) => {
          e.stopPropagation(); // jangan ikut membuka drawer dari klik baris
          onClick();
        };
        return variant === "bar" ? (
          <button
            type="button"
            className="progress-trigger"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`Progres ${p.progress}%, lihat histori`}
            onClick={handleClick}
          >
            <span className="row-between t-caption mb-4">
              <span>{label}</span>
              <span className="row gap-6">Progres {p.progress}% <Icon name="history" /></span>
            </span>
            <span className="progress-track"><span className="progress-fill" style={{ width: `${p.progress}%` }} /></span>
          </button>
        ) : (
          <button
            type="button"
            className="link-btn row gap-6 progress-link"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={handleClick}
          >
            <Icon name="history" /> Lihat histori progres
          </button>
        );
      }}
    >
      {() => <HistoryPanel project={p} />}
    </Popover>
  );
}
