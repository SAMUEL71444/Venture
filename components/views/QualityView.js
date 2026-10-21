"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import DataTable from "@/components/ui/DataTable";
import { REPORTS, REPORT_STATUS_META } from "@/lib/reports.mock";
import { getPlatformProjects } from "@/lib/platform-projects.mock";
import { getAllProjects } from "@/lib/projects.mock";
import { formatTanggal } from "@/lib/format";

// Kualitas Kerja: proyek yang dilaporkan/bersengketa (lib/reports.mock.js,
// hanya yang `category` menyentuh hasil kerja), preview file yang sudah
// dikirim freelancer (project.deliverables — hasil replay event yang sama
// dipakai di mana-mana, bukan daftar baru) + catatan dari laporan terkait.
export default function QualityView() {
  const [active, setActive] = useState(null);

  const projects = useMemo(() => getPlatformProjects(getAllProjects()), []);
  const rows = useMemo(() => {
    return REPORTS
      .filter((r) => r.projectId && r.category !== "penipuan")
      .map((r) => {
        const project = projects.find((p) => p.id === r.projectId);
        return project ? { report: r, project } : null;
      })
      .filter(Boolean);
  }, [projects]);

  const columns = [
    { key: "title", label: "Proyek", render: (row) => <span style={{ fontWeight: 700 }}>{row.project.title}</span> },
    { key: "client", label: "UMKM", render: (row) => row.project.client },
    { key: "freelancer", label: "Freelancer", render: (row) => row.project.freelancerName || "Nadia Putri" },
    { key: "issue", label: "Isu", render: (row) => row.report.title },
    { key: "status", label: "Status", render: (row) => {
      const st = REPORT_STATUS_META[row.report.status];
      return <span className={`badge ${st.badgeClass}`}>{st.label}</span>;
    } },
  ];

  return (
    <>
      <h1 className="t-h1 mb-4">Kualitas Kerja</h1>
      <p className="t-body muted mb-20">Proyek yang dilaporkan atau sedang dalam sengketa kualitas hasil kerja.</p>

      <DataTable columns={columns} rows={rows} onRowClick={setActive} empty="Tidak ada proyek bersengketa saat ini." />

      <Drawer open={!!active} onClose={() => setActive(null)} title={active?.project.title || "Detail Sengketa"}>
        {active && (
          <div className="job-detail">
            <div className="t-small muted">{active.project.client} · Freelancer: {active.project.freelancerName || "Nadia Putri"}</div>

            <div className="divider" />

            <div className="t-caption mb-8">FILE YANG SUDAH DIKIRIM</div>
            {active.project.deliverables.length === 0 ? (
              <p className="t-small muted">Belum ada file yang dikirim.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {active.project.deliverables.map((d, i) => (
                  <div key={i} className="card card-pad row-between">
                    <span className="row gap-6 t-small"><Icon name="fileText" /> {d.file}</span>
                    <span className="t-caption">{formatTanggal(d.date)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="divider" />

            <div className="t-caption mb-8">CATATAN & KRONOLOGI</div>
            <ol className="history-timeline" style={{ padding: 0 }}>
              {active.report.chronology.map((c, i) => (
                <li key={i} className="history-event">
                  <span className="history-icon tone-neutral"><Icon name="clock" /></span>
                  <div className="history-body">
                    <div className="t-small">{c.note}</div>
                    <div className="history-meta"><span>{formatTanggal(c.date)}</span></div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Drawer>
    </>
  );
}
