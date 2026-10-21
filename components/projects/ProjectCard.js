"use client";

import Icon from "@/components/Icon";
import { STATUS_META, MOCK_TODAY } from "@/lib/projects.mock";
import { formatRupiah, formatTanggal, sisaHari } from "@/lib/format";
import { useChat } from "@/context/ChatContext";
import ProgressHistoryPopover from "./ProgressHistoryPopover";

const ACTIVE_NOTES = {
  berjalan: "Sedang dikerjakan",
  menunggu_review: "Menunggu persetujuan klien",
  revisi: "Klien minta revisi",
};

// Baris proyek gaya feed "Cari Proyek" di dashboard (lihat ProjectCardMaha):
// satu baris besar di dalam .job-feed-list. Klik baris membuka drawer detail;
// tombol ikon stopPropagation supaya nggak ikut membuka drawer.
// `onToggleSave` cuma dikasih di tab "Disimpan".
// `perspective="client"` dipakai sudut pandang UMKM (lihat ProjectsView) —
// baris info nunjukkin nama FREELANCER (bukan klien, yang notabene UMKM itu
// sendiri), dan nggak ada tombol simpan (UMKM nggak "nyimpen" proyek sendiri).
export default function ProjectCard({ project: p, onOpenDetail, isSaved, onToggleSave, perspective = "freelancer" }) {
  const { openWidget } = useChat();
  const meta = STATUS_META[p.status];
  const isActive = p.status in ACTIVE_NOTES;
  const deadline = isActive || p.status === "terbuka" ? sisaHari(p.deadline, MOCK_TODAY) : null;
  const muted = onToggleSave && !isSaved;
  const isClientView = perspective === "client";
  // Proyek yang baru diposting UMKM belum punya freelancer: tidak ada
  // lawan bicara untuk dikirimi pesan.
  const noFreelancer = isClientView && !p.freelancerName;

  return (
    <div className={`job-item ${muted ? "job-item-dismissed" : ""}`} onClick={() => onOpenDetail(p)}>
      <div className="job-item-meta">
        <span className="row gap-10" style={{ flexWrap: "wrap" }}>
          <span className={`badge ${meta.badgeClass}`}>
            <Icon name={meta.icon} /> {meta.label}
          </span>
          {p.status === "terbuka"
            ? <span>Lowongan terbuka · {p.location}</span>
            : <span>Diperbarui {formatTanggal(p.updatedAt)}</span>}
        </span>

        <div className="job-item-actions">
          {!noFreelancer && (
            <button
              type="button"
              className="icon-circle-btn"
              onClick={(e) => { e.stopPropagation(); openWidget(p.id); }}
              aria-label={`Kirim pesan ke ${isClientView ? p.freelancerName : p.client}`}
              data-tooltip={isClientView ? "Pesan freelancer" : "Pesan klien"}
            >
              <Icon name="chat" />
            </button>
          )}
          {!isClientView && onToggleSave && (
            <button
              type="button"
              className={`icon-circle-btn ${isSaved ? "saved-bookmark" : ""}`}
              onClick={(e) => { e.stopPropagation(); onToggleSave(p.id); }}
              aria-pressed={isSaved}
              aria-label={isSaved ? "Hapus dari simpanan" : "Simpan proyek"}
              data-tooltip={isSaved ? "Hapus dari simpanan" : "Simpan proyek"}
            >
              <Icon name={isSaved ? "bookmarkFilled" : "bookmark"} />
            </button>
          )}
        </div>
      </div>

      <h3 className="job-item-title">{p.title}</h3>

      <div className="job-item-info">
        {isClientView ? (p.freelancerName || "Menunggu freelancer") : p.client} · {p.category} · Anggaran <strong>{formatRupiah(p.budget)}</strong> · Tenggat {formatTanggal(p.deadline)}
        {deadline && <span className={`deadline-hint ${deadline.tone}`}>{deadline.label}</span>}
      </div>

      <p className="job-item-desc job-item-desc-short">{p.description}</p>

      <div className="job-item-footer">
        {isActive && (
          <div className="job-item-progress">
            <ProgressHistoryPopover project={p} variant="bar" label={ACTIVE_NOTES[p.status]} />
          </div>
        )}
        {p.status === "selesai" && (
          <>
            <span className="job-item-status-note success">
              <Icon name="checkCircle" /> Selesai &amp; dibayar · {formatRupiah(p.budget)}
            </span>
            <ProgressHistoryPopover project={p} variant="link" />
          </>
        )}
        {p.status === "dibatalkan" && (
          <>
            <span className="job-item-status-note">
              <Icon name="xCircle" /> Dibatalkan klien · terhenti di {p.progress}%
            </span>
            <ProgressHistoryPopover project={p} variant="link" />
          </>
        )}
        {p.status === "terbuka" && (
          <>
            <span className="chip">{p.category}</span>
            <span className="link-btn row gap-6">Lihat lowongan <Icon name="arrowRight" /></span>
          </>
        )}
      </div>
    </div>
  );
}
