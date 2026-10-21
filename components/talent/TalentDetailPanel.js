"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import Popover from "@/components/ui/Popover";
import TalentThumb from "./TalentThumb";
import { initials } from "@/lib/mock-data";
import { formatRupiah, formatRupiahShort, formatTanggal } from "@/lib/format";
import { TALENT_BADGES, SKILL_LEVELS, TIMEZONE_OFFSET } from "@/lib/talents.mock";

const TABS = [
  ["tentang", "Tentang"],
  ["ulasan", "Ulasan Klien"],
  ["riwayat", "Riwayat Kerja"],
  ["portofolio", "Portofolio"],
  ["pengalaman", "Pengalaman Kerja"],
  ["skill", "Skill"],
];
const REVIEWS_PER_PAGE = 2;

function Stars({ n }) {
  return (
    <span className="fp-stars" aria-label={`${n} dari 5 bintang`}>
      {"★".repeat(Math.round(n))}<span style={{ color: "var(--border-strong)" }}>{"★".repeat(5 - Math.round(n))}</span>
    </span>
  );
}

function useLocalTime(offset) {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date(Date.now() + offset * 3600e3).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [offset]);
  return t;
}

// Panel detail talent (slide-in dari kanan, memakai Drawer). Dibuka dari
// kartu hasil pencarian lewat FindTalentView (`selectedId`). Status
// disimpan/diundang datang dari view, jadi sinkron dengan kartunya.
export default function TalentDetailPanel({ talent: current, query, saved, invited, onClose, onToggleSave, onInvite, showToast }) {
  // Talent terakhir tetap dirender selama animasi tutup drawer berjalan.
  const last = useRef(current);
  if (current) last.current = current;
  const t = last.current;

  const header = (
    <div className="ftd-topbar">
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Kembali ke hasil pencarian">
        <Icon name="chevLeft" />
      </button>
      <button type="button" className="link-btn row gap-6" onClick={() => showToast("Halaman profil publik mahasiswa belum tersedia di prototipe ini.")}>
        Lihat Profil Lengkap <Icon name="externalLink" />
      </button>
    </div>
  );

  return (
    <Drawer open={!!current} onClose={onClose} title={t ? `Detail ${t.name}` : "Detail talenta"} width={880} header={header}>
      {t && (
        <PanelBody
          key={t.id} t={t} query={query} saved={saved} invited={invited}
          onToggleSave={onToggleSave} onInvite={onInvite} showToast={showToast}
        />
      )}
    </Drawer>
  );
}

function PanelBody({ t, query, saved, invited, onToggleSave, onInvite, showToast }) {
  const [tab, setTab] = useState("tentang");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const time = useLocalTime(TIMEZONE_OFFSET[t.timezone] ?? 7);
  const badge = TALENT_BADGES[t.badge];

  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/find-talent?talent=${t.id}`);
      showToast("Tautan profil disalin.");
    } catch {
      showToast("Tidak bisa menyalin tautan di browser ini.");
    }
  }

  return (
    <div className="ftd-layout">
      <div className="ftd-side">
        <div className="ftd-avatar-wrap">
          <div className="avatar ftd-avatar" style={{ background: t.avatarBg }}>{initials(t.name)}</div>
          {t.available && <span className="ft-online-dot ftd-online" aria-label="Online" />}
          <button
            type="button" className="icon-circle-btn saved ftd-save" aria-pressed={saved}
            aria-label={saved ? "Hapus dari simpanan" : "Simpan"} onClick={() => onToggleSave(t.id)}
          >
            <Icon name={saved ? "heartFilled" : "heart"} />
          </button>
        </div>

        <div className="ftd-name">
          {t.name}
          {t.badge && t.badge !== "baru" && <span className="ftd-verified" title="Terverifikasi"><Icon name="checkCircle" /></span>}
        </div>
        <div className="t-small muted" style={{ textAlign: "center" }}>{t.title}</div>
        {t.available && <div className="ft-available t-caption" style={{ textAlign: "center", marginTop: 6 }}>⚡ Terbuka untuk kerja</div>}

        <div className="ftd-badges">
          <span className="ft-success"><Icon name="award" /> {t.successRate}% Tingkat Keberhasilan</span>
          {badge && <span className={`badge ${badge.className}`}><Icon name={badge.icon} /> {badge.label}</span>}
        </div>
        <div className="ftd-facts">
          <div><Stars n={t.rating} /> <b>{t.rating.toFixed(1)}</b> <span className="muted">({t.reviewCount} ulasan)</span></div>
          <div className="row gap-6"><Icon name="mapPin" /> {t.city}{time && ` · ${time} ${t.timezone}`}</div>
          <div className="row gap-6"><Icon name="clock" /> Rata-rata respons {t.responseTime}</div>
        </div>

        <div className="ftd-stats">
          <div><b>{formatRupiahShort(t.earnings)}+</b><span>Total Penghasilan</span></div>
          <div><b>{t.totalProjects}</b><span>Total Proyek</span></div>
          <div><b>{t.totalHours}</b><span>Total Jam Kerja</span></div>
        </div>

        <div className="ftd-actions">
          <button type="button" className="btn btn-primary" onClick={() => showToast("Rekrut langsung belum tersedia di prototipe ini.")}>Rekrut</button>
          <button type="button" className="btn btn-secondary" disabled={invited} onClick={() => onInvite(t.id)}>
            {invited ? "Diundang" : "Ajak"}
          </button>
          <Popover
            align="end"
            panelClassName="ftd-more-menu"
            trigger={({ open, onClick }) => (
              <button type="button" className="icon-circle-btn" onClick={onClick} aria-haspopup="menu" aria-expanded={open} aria-label="Aksi lain">
                <span style={{ fontWeight: 800, letterSpacing: 1, lineHeight: 1 }}>⋯</span>
              </button>
            )}
          >
            {({ close }) => (
              <div role="menu">
                <button type="button" role="menuitem" className="user-menu-item" onClick={() => { close(); share(); }}><Icon name="arrowUpRight" /> Bagikan</button>
                <button type="button" role="menuitem" className="user-menu-item" onClick={() => { close(); setNoteOpen(true); }}><Icon name="pencil" /> Tambah Catatan</button>
                <button type="button" role="menuitem" className="user-menu-item danger" onClick={() => { close(); showToast("Laporan dikirim ke tim Verify & Trust."); }}><Icon name="flag" /> Laporkan</button>
              </div>
            )}
          </Popover>
        </div>

        {noteOpen && (
          <div className="fp-fresh mt-12">
            <textarea className="input" rows={3} placeholder="Catatan pribadi tentang talenta ini…" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row gap-8 mt-8" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNoteOpen(false)}>Tutup</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setNoteOpen(false); showToast("Catatan disimpan."); }}>Simpan</button>
            </div>
          </div>
        )}
        {!noteOpen && note && <p className="t-caption mt-12">📝 {note}</p>}
      </div>

      <div className="ftd-main">
        <div className="tabs ftd-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="settings-panel" key={tab}>
          {tab === "tentang" && <AboutTab t={t} />}
          {tab === "ulasan" && <ReviewsTab t={t} />}
          {tab === "riwayat" && <HistoryTab t={t} query={query} />}
          {tab === "portofolio" && (
            <div className="fp-grid-cards">
              {t.portfolio.map((p) => <TalentThumb key={p.id} color={t.avatarBg} item={p} size="100%" />)}
            </div>
          )}
          {tab === "pengalaman" && (
            <div className="fp-list">
              {t.experience.map((e) => (
                <div key={e.id} className="fp-list-item" style={{ display: "block" }}>
                  <div className="t-small" style={{ fontWeight: 700 }}>{e.title}</div>
                  <div className="t-caption">{e.org} · {e.period}</div>
                </div>
              ))}
            </div>
          )}
          {tab === "skill" && (
            <div className="fp-list">
              {t.skills.map((s) => (
                <div key={s.name} className="fp-list-item" style={{ alignItems: "center" }}>
                  <span className="t-small" style={{ fontWeight: 600 }}>{s.name}</span>
                  <span className="row gap-8">
                    <span className="ftd-level-bar"><span style={{ width: `${(s.level / 3) * 100}%` }} /></span>
                    <span className="t-caption" style={{ width: 64 }}>{SKILL_LEVELS[s.level]}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AboutTab({ t }) {
  return (
    <div className="card ftd-section">
      <div className="t-h3" style={{ fontSize: 16 }}>Ringkasan</div>
      <p className="t-small mt-8" style={{ lineHeight: 1.65 }}>{t.summary}</p>
      <p className="t-caption mt-8">Ringkasan dibuat dari proyek yang sudah diselesaikan di Digital.in.</p>

      <div className="t-h3 mt-20" style={{ fontSize: 15 }}>Skill yang digunakan</div>
      <div className="row mt-8" style={{ flexWrap: "wrap", gap: 6 }}>
        {t.skills.map((s) => <span key={s.name} className="chip">{s.name}</span>)}
      </div>

      <div className="t-h3 mt-20" style={{ fontSize: 15 }}>Pendidikan</div>
      <p className="t-small mt-4">{t.education} {t.major} — {t.uni}</p>
      {t.association && <div className="ft-association mt-12"><Icon name="users" /> Terasosiasi dengan {t.association}</div>}
    </div>
  );
}

function ReviewsTab({ t }) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});
  const pages = Math.ceil(t.reviews.length / REVIEWS_PER_PAGE);
  const shown = t.reviews.slice((page - 1) * REVIEWS_PER_PAGE, page * REVIEWS_PER_PAGE);

  return (
    <>
      <div className="ftd-review-grid">
        {shown.map((r) => (
          <div key={r.id} className="card ftd-review-card">
            <div className="t-small" style={{ fontWeight: 600 }}>{r.project}</div>
            <div className="row-between t-caption mt-4">
              <span className="row gap-6"><Icon name="calendar" /> {formatTanggal(r.date)}</span>
              <span><Stars n={r.rating} /> {r.rating.toFixed(1)}</span>
            </div>
            <p className={`t-small mt-8 ftd-quote ${expanded[r.id] ? "open" : ""}`}>“{r.comment}”</p>
            <button type="button" className="link-btn" style={{ fontSize: 12.5 }} onClick={() => setExpanded((e) => ({ ...e, [r.id]: !e[r.id] }))}>
              {expanded[r.id] ? "Lihat lebih sedikit" : "Lihat lebih banyak"}
            </button>
            <div className="row mt-8" style={{ flexWrap: "wrap", gap: 6 }}>
              {r.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
            </div>
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="ftd-pagination">
          <button type="button" className="icon-circle-btn" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Sebelumnya"><Icon name="chevLeft" /></button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={`ftd-page ${n === page ? "active" : ""}`} onClick={() => setPage(n)}>{n}</button>
          ))}
          <button type="button" className="icon-circle-btn" disabled={page === pages} onClick={() => setPage((p) => p + 1)} aria-label="Berikutnya"><Icon name="chevRight" /></button>
        </div>
      )}
    </>
  );
}

function HistoryTab({ t, query }) {
  const [filter, setFilter] = useState("terkait");
  const [open, setOpen] = useState({});
  const q = query.trim().toLowerCase();
  const skillMatch = t.skills.some((s) => s.name.toLowerCase().includes(q));

  const groups = {
    terkait: t.workHistory.filter((w) => !q || skillMatch || w.title.toLowerCase().includes(q) || w.desc.toLowerCase().includes(q)),
    selesai: t.workHistory.filter((w) => w.status === "selesai"),
    berjalan: t.workHistory.filter((w) => w.status === "berjalan"),
  };
  const items = groups[filter];

  return (
    <div className="card ftd-section">
      <div className="t-h3" style={{ fontSize: 16 }}>Riwayat kerja di Digital.in</div>
      <div className="row gap-8 mt-12" style={{ flexWrap: "wrap" }}>
        {[["terkait", "Terkait Pencarian"], ["selesai", "Selesai"], ["berjalan", "Sedang Berjalan"]].map(([id, label]) => (
          <button key={id} type="button" className={`pill-tab ${filter === id ? "active" : ""}`} onClick={() => setFilter(id)}>
            {label} ({groups[id].length})
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="t-small muted mt-16">Belum ada pekerjaan di kategori ini.</p>
      ) : (
        <div className="fp-list mt-8">
          {items.map((w) => (
            <div key={w.id} className="fp-list-item" style={{ display: "block" }}>
              <div className="row-between" style={{ gap: 12, alignItems: "flex-start" }}>
                <div className="t-small" style={{ fontWeight: 700 }}>{w.title}</div>
                {w.rating ? <span className="t-caption" style={{ whiteSpace: "nowrap" }}><Stars n={w.rating} /> {w.rating.toFixed(1)}</span> : <span className="badge badge-info">Berjalan</span>}
              </div>
              <div className="ftd-history-meta">
                <span><Icon name="wallet" /> {formatRupiah(w.paid)}</span>
                <span><Icon name="trendingUp" /> {formatRupiah(w.rate)}/jam</span>
                <span><Icon name="clock" /> {w.hours} jam</span>
                <span><Icon name="calendar" /> {formatTanggal(w.start)} – {w.end ? formatTanggal(w.end) : "Sekarang"}</span>
              </div>
              {open[w.id] && <p className="t-small muted mt-8 fp-fresh">{w.desc}</p>}
              <button type="button" className="link-btn mt-4" style={{ fontSize: 12.5 }} onClick={() => setOpen((o) => ({ ...o, [w.id]: !o[w.id] }))}>
                {open[w.id] ? "Sembunyikan detail" : "Lihat detail"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
