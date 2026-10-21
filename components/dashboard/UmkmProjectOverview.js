"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import Illustration from "@/components/ui/Illustration";
import ProjectCard from "@/components/projects/ProjectCard";
import { STATUS_META } from "@/lib/projects.mock";
import { formatRupiah, formatTanggal } from "@/lib/format";

function Stat({ label, value, sub, tone }) {
  return (
    <div className="ud-stat">
      <div className="t-caption">{label}</div>
      <div className="ud-stat-value">{value}</div>
      {sub && <div className={`ud-stat-sub ${tone || ""}`}>{sub}</div>}
    </div>
  );
}

// Kartu proyek ringkas untuk tampilan grid. Tampilan list memakai
// ProjectCard yang sama dengan halaman Proyek.
function GridCard({ project: p, onOpen }) {
  const meta = STATUS_META[p.status];
  const isOpen = p.status === "terbuka";
  return (
    <div
      className="ud-project-card" role="button" tabIndex={0}
      onClick={() => onOpen(p)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(p); }}
    >
      <div className="row-between" style={{ gap: 8 }}>
        <span className={`badge ${meta.badgeClass}`}><Icon name={meta.icon} /> {meta.label}</span>
        <span className="t-caption">Tenggat {formatTanggal(p.deadline)}</span>
      </div>
      <h3 className="ud-project-title">{p.title}</h3>
      <div className="t-small muted">{p.freelancerName || "Menunggu freelancer"} · {formatRupiah(p.budget)}</div>
      {isOpen ? (
        <div className="t-caption mt-12">{p.milestones.length} milestone · belum ada freelancer yang dipilih</div>
      ) : (
        <>
          <div className="row-between t-caption mt-12 mb-4"><span>Progress</span><span>{p.progress}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${p.progress}%` }} /></div>
        </>
      )}
    </div>
  );
}

// Ringkasan proyek aktif: kosong -> ilustrasi + dua aksi; ada data -> strip
// angka + daftar (list/grid). Angka datang dari lib/umkm-dashboard.js.
export default function UmkmProjectOverview({ data, view, onViewChange, onOpenProject }) {
  // Proyek terbuka (baru diposting, menunggu freelancer) ikut tampil, paling
  // atas. Empty state cuma kalau tidak ada yang aktif DAN tidak ada yang terbuka.
  const visible = [...data.open, ...data.active];
  const empty = visible.length === 0;
  const dl = data.nextDeadline;

  return (
    <section className="ud-section">
      <div className="ud-section-head ud-section-head--actions">
        <h2 className="ud-section-title">Ringkasan</h2>
        <div className="ud-section-actions">
          <Link href="/projects?new=1" className="btn btn-primary"><Icon name="plus" /> Posting Proyek</Link>
          <div className="ud-view-toggle" role="group" aria-label="Tampilan ringkasan">
            <button type="button" className={view === "grid" ? "active" : ""} onClick={() => onViewChange("grid")} aria-label="Tampilan kotak" aria-pressed={view === "grid"}>
              <Icon name="layoutGrid" />
            </button>
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => onViewChange("list")} aria-label="Tampilan daftar" aria-pressed={view === "list"}>
              <Icon name="list" />
            </button>
          </div>
        </div>
      </div>

      {empty ? (
        <div className="ud-empty">
          <Illustration name="folder" size={104} />
          <p className="ud-empty-title">Belum ada postingan proyek atau kontrak yang berjalan</p>
          <p className="t-small muted" style={{ maxWidth: 380, margin: "6px auto 0" }}>
            Posting proyek pertamamu atau cari freelancer yang cocok — dana baru ditahan di escrow saat kamu memulai.
          </p>
          <div className="row gap-10" style={{ justifyContent: "center", flexWrap: "wrap", marginTop: 22 }}>
            <Link href="/find-talent" className="btn btn-secondary"><Icon name="search" /> Cari Freelancer</Link>
            <Link href="/projects?new=1" className="btn btn-primary"><Icon name="plus" /> Posting Proyek</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="ud-stats">
            <Stat
              label="PROYEK AKTIF" value={data.activeCount}
              sub={`${data.projects.length} proyek tercatat${data.openCount ? ` · ${data.openCount} terbuka` : ""}`}
            />
            <Stat label="DANA TERTAHAN" value={formatRupiah(data.danaTertahan)} sub="Menunggu persetujuanmu" />
            <Stat label="TENGGAT TERDEKAT" value={dl ? dl.label : "–"} sub={dl?.title} tone={dl?.tone === "warning" || dl?.tone === "danger" ? "warn" : ""} />
            <Stat label="TOTAL PENGELUARAN" value={formatRupiah(data.totalPengeluaran)} sub="Sudah cair ke freelancer" />
          </div>

          {view === "grid" ? (
            <div className="ud-grid ud-fade" key="grid">
              {visible.map((p) => <GridCard key={p.id} project={p} onOpen={onOpenProject} />)}
            </div>
          ) : (
            <div className="job-feed-list ud-fade" key="list" style={{ marginTop: 16 }}>
              {visible.map((p) => <ProjectCard key={p.id} project={p} onOpenDetail={onOpenProject} perspective="client" />)}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <Link href="/projects" className="link-btn row gap-6" style={{ display: "inline-flex" }}>Lihat semua proyek <Icon name="arrowRight" /></Link>
          </div>
        </>
      )}
    </section>
  );
}
