"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import DataTable from "@/components/ui/DataTable";
import { REPORTS, REPORT_CATEGORY_META, REPORT_STATUS_META } from "@/lib/reports.mock";
import { effectiveReports } from "@/lib/activity-log";
import { useActivityLog } from "@/context/ActivityLogContext";
import { formatTanggal } from "@/lib/format";

const CATEGORY_FILTERS = [null, "penipuan", "kerja_tidak_sesuai", "pelanggaran_lain"];
const STATUS_FILTERS = [null, "baru", "diproses", "selesai"];

// Laporan & Sengketa: filter kategori + status, drawer kronologi + riwayat
// tindakan, dan aksi ubah status (dicatat sebagai tindakan baru). Status &
// riwayat tindakan sekarang DITURUNKAN dari log aktivitas terpusat
// (effectiveReports, lib/activity-log.js): data bawaan + tindakan sesi ini,
// jadi tidak hilang saat pindah halaman dan otomatis terhitung di statistik
// profil admin ("Laporan Ditangani"). `?report=<id>` (dari Aktivitas Terbaru
// di Profil) membuka detail laporan itu langsung. useSearchParams wajib
// dibungkus <Suspense>.
export default function ReportsView() {
  return (
    <Suspense fallback={null}>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const { entries, log } = useActivityLog();
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [activeId, setActiveId] = useState(() => {
    const id = searchParams.get("report");
    return REPORTS.some((r) => r.id === id) ? id : null;
  });
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState("diproses");

  const reports = useMemo(() => effectiveReports(entries), [entries]);

  const rows = useMemo(() => {
    return reports
      .filter((r) => !categoryFilter || r.category === categoryFilter)
      .filter((r) => !statusFilter || r.status === statusFilter);
  }, [reports, categoryFilter, statusFilter]);

  const activeReport = reports.find((r) => r.id === activeId) || null;

  function submitAction() {
    if (!note.trim() || !activeReport) return;
    log({
      category: "laporan", action: nextStatus === "selesai" ? "selesai" : "diproses",
      summary: `${nextStatus === "selesai" ? "Menyelesaikan" : "Memproses"} laporan: ${activeReport.title}`,
      refs: { reportId: activeReport.id, projectId: activeReport.projectId },
      meta: { status: nextStatus, note: note.trim() },
    });
    setNote("");
  }

  const columns = [
    { key: "title", label: "Laporan", render: (r) => <span style={{ fontWeight: 700 }}>{r.title}</span> },
    { key: "category", label: "Kategori", render: (r) => {
      const c = REPORT_CATEGORY_META[r.category];
      return <span className={`badge ${c.badgeClass}`}><Icon name="flag" /> {c.label}</span>;
    } },
    { key: "against", label: "Terlapor", render: (r) => r.against },
    { key: "status", label: "Status", render: (r) => {
      const s = REPORT_STATUS_META[r.status];
      return <span className={`badge ${s.badgeClass}`}>{s.label}</span>;
    } },
    { key: "openedAt", label: "Dibuka", render: (r) => formatTanggal(r.openedAt) },
  ];

  return (
    <>
      <h1 className="t-h1 mb-4">Laporan & Sengketa</h1>
      <p className="t-body muted mb-20">Tindak lanjuti laporan penipuan, kerja tidak sesuai, dan pelanggaran lain.</p>

      <div className="row gap-8 mb-10" style={{ flexWrap: "wrap" }}>
        <button type="button" className={`chip-filter ${categoryFilter === null ? "active" : ""}`} onClick={() => setCategoryFilter(null)}>Semua Kategori</button>
        {CATEGORY_FILTERS.filter(Boolean).map((c) => (
          <button key={c} type="button" className={`chip-filter ${categoryFilter === c ? "active" : ""}`} onClick={() => setCategoryFilter(c)}>
            {REPORT_CATEGORY_META[c].label}
          </button>
        ))}
      </div>
      <div className="row gap-8 mb-16" style={{ flexWrap: "wrap" }}>
        <button type="button" className={`chip-filter ${statusFilter === null ? "active" : ""}`} onClick={() => setStatusFilter(null)}>Semua Status</button>
        {STATUS_FILTERS.filter(Boolean).map((s) => (
          <button key={s} type="button" className={`chip-filter ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
            {REPORT_STATUS_META[s].label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={rows} onRowClick={(r) => setActiveId(r.id)} empty="Tidak ada laporan untuk filter ini." />

      <Drawer open={!!activeReport} onClose={() => { setActiveId(null); setNote(""); }} title={activeReport?.title || "Detail Laporan"}>
        {activeReport && (
          <div className="job-detail">
            <div className="row-between">
              <span className={`badge ${REPORT_CATEGORY_META[activeReport.category].badgeClass}`}>
                <Icon name="flag" /> {REPORT_CATEGORY_META[activeReport.category].label}
              </span>
              <span className={`badge ${REPORT_STATUS_META[activeReport.status].badgeClass}`}>{REPORT_STATUS_META[activeReport.status].label}</span>
            </div>
            <div className="t-small muted mt-8">
              Pelapor: {activeReport.reporterName} ({activeReport.reportedBy === "umkm" ? "UMKM" : "Mahasiswa"}) · Terlapor: {activeReport.against}
            </div>

            <div className="divider" />

            <div className="t-caption mb-8">KRONOLOGI</div>
            <ol className="history-timeline" style={{ padding: 0 }}>
              {activeReport.chronology.map((c, i) => (
                <li key={i} className="history-event">
                  <span className="history-icon tone-neutral"><Icon name="clock" /></span>
                  <div className="history-body">
                    <div className="t-small">{c.note}</div>
                    <div className="history-meta"><span>{formatTanggal(c.date)}</span></div>
                  </div>
                </li>
              ))}
            </ol>

            {activeReport.actions.length > 0 && (
              <>
                <div className="divider" />
                <div className="t-caption mb-8">RIWAYAT TINDAKAN</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeReport.actions.map((a, i) => (
                    <div key={i} className="t-caption" style={{ lineHeight: 1.5 }}>
                      <b>{a.by}</b> — {a.note}
                      <div style={{ color: "var(--text-faint)" }}>{formatTanggal(a.date)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeReport.status !== "selesai" && (
              <>
                <div className="divider" />
                <div className="t-caption mb-8">UBAH STATUS + CATATAN</div>
                <select className="input mb-8" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                  <option value="diproses">Diproses</option>
                  <option value="selesai">Selesai</option>
                </select>
                <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan tindakan..." />
                <button type="button" className="btn btn-primary btn-block mt-8" disabled={!note.trim()} onClick={submitAction}>
                  Simpan Tindakan
                </button>
              </>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
