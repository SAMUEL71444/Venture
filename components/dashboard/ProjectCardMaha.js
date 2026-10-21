"use client";

import Icon from "@/components/Icon";

// Baris pekerjaan besar gaya Upwork — bukan kartu tipis lagi. Satu proyek,
// satu baris tinggi berisi meta posting, judul besar, info harga/level,
// deskripsi, tag skill, dan info klien. Klik baris membuka drawer detail
// lewat `onClick(project)` dari parent (JobFeed); klik tombol ikon (simpan/
// tidak tertarik) sengaja stopPropagation supaya nggak ikut buka drawer.
export default function ProjectCardMaha({ project: p, onClick, saved, onToggleSave, dismissed, onToggleDismiss }) {
  function stop(e) {
    e.stopPropagation();
  }

  return (
    <div
      className={`job-item ${dismissed ? "job-item-dismissed" : ""}`}
      onClick={() => onClick?.(p)}
    >
      <div className="job-item-meta">
        <span>Diposting {p.postedAgo} · {p.applicants} pelamar</span>
        <div className="job-item-actions">
          <button
            type="button"
            className="icon-circle-btn"
            onClick={(e) => { stop(e); onToggleDismiss?.(p.id); }}
            aria-pressed={dismissed}
            aria-label={dismissed ? "Batalkan tidak tertarik" : "Tidak tertarik"}
            data-tooltip={dismissed ? "Batalkan tidak tertarik" : "Tidak tertarik"}
          >
            <Icon name="thumbsDown" />
          </button>
          <button
            type="button"
            className={`icon-circle-btn ${saved ? "saved" : ""}`}
            onClick={(e) => { stop(e); onToggleSave?.(p.id); }}
            aria-pressed={saved}
            aria-label={saved ? "Hapus dari simpanan" : "Simpan proyek"}
            data-tooltip={saved ? "Hapus dari simpanan" : "Simpan proyek"}
          >
            <Icon name={saved ? "heartFilled" : "heart"} />
          </button>
        </div>
      </div>

      <h3 className="job-item-title">{p.title}</h3>

      <div className="job-item-info">
        {p.type} · {p.level} · Anggaran: <strong>{p.budget}</strong> · Tenggat {p.deadline}
      </div>

      <p className="job-item-desc">{p.desc}</p>

      {p.skills?.length > 0 && (
        <div className="job-item-skills">
          {p.skills.map((s) => <span key={s} className="chip">{s}</span>)}
        </div>
      )}

      <div className="job-item-client">
        {p.clientVerified && (
          <span className="job-item-client-verified"><Icon name="checkCircle" /> Pembayaran terverifikasi</span>
        )}
        <span className="rating"><Icon name="star" /> {p.clientRating}</span>
        <span>{p.clientSpent}</span>
        <span className="row gap-4"><Icon name="mapPin" /> {p.location}</span>
      </div>
    </div>
  );
}
