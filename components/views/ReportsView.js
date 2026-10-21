"use client";

import { useCallback, useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import DataTable from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { adminApi } from "@/lib/admin/api";
import { formatRupiah, formatTanggal } from "@/lib/format";

const FILTERS = [
  { id: "open", label: "Terbuka" },
  { id: "resolved", label: "Selesai" },
  { id: "", label: "Semua" },
];
const ALERT_STATUS = {
  OPEN: { label: "Baru", badge: "badge-warning" },
  FOLLOWED_UP: { label: "Ditindaklanjuti", badge: "badge-info" },
  AWAITING_DECISION: { label: "Menunggu keputusan", badge: "badge-warning" },
  RESOLVED: { label: "Selesai", badge: "badge-success" },
};
const REVIEW_DECISION = { APPROVED: "Disetujui", NEEDS_CHANGES: "Perlu perbaikan", REVISION_REQUESTED: "Minta revisi" };
const REVIEWER = { MENTOR: "Mentor", CLIENT: "UMKM", UMKM: "UMKM", ADMIN: "Admin" };
const date = (iso) => (iso ? formatTanggal(iso.slice(0, 10)) : "—");
const requester = (d) => (d.requester_role === "STUDENT" ? d.student?.name : d.umkm?.name) || "—";
const against = (d) => (d.requester_role === "STUDENT" ? d.umkm?.name : d.student?.name) || "—";

// Laporan & Sengketa: sengketa milestone (setelah jatah revisi habis) dari
// GET /admin/disputes. Keputusan memakai endpoint yang ada:
// - Cairkan ke mahasiswa   → POST /admin/milestones/{id}/force-approve
// - Kembalikan ke mahasiswa → POST /admin/milestones/{id}/return-to-student (wajib catatan)
// Pelaku keputusan dicatat backend di audit log.
export default function ReportsView() {
  const [filter, setFilter] = useState("open");
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null); // "release" | "return"
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const res = await adminApi.disputes({ per_page: 50, ...(filter ? { status: filter } : {}) });
    if (!res.ok) {
      setLoadError(res.error.message);
      return;
    }
    setLoadError(null);
    setRows(res.data);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (id) => {
    setDetail(null);
    const res = await adminApi.dispute(id);
    setDetail(res.ok ? res.data : { error: res.error.message });
  }, []);

  useEffect(() => {
    if (activeId) loadDetail(activeId);
  }, [activeId, loadDetail]);

  async function decide(notes) {
    const milestoneId = detail.milestone.id;
    const res = confirm === "release" ? await adminApi.forceApprove(milestoneId, notes) : await adminApi.returnToStudent(milestoneId, notes);
    if (!res.ok) return res;
    setConfirm(null);
    setToast(confirm === "release" ? "Sengketa diputus: dana dicairkan ke mahasiswa." : "Sengketa diputus: milestone dikembalikan untuk diperbaiki.");
    setTimeout(() => setToast(null), 2800);
    loadDetail(activeId);
    load();
    return res;
  }

  const columns = [
    { key: "project", label: "Proyek", render: (d) => <span style={{ fontWeight: 700 }}>{d.project?.title || "—"}</span> },
    { key: "milestone", label: "Milestone", render: (d) => d.milestone?.title || "—" },
    { key: "by", label: "Diajukan oleh", render: requester },
    { key: "against", label: "Terhadap", render: against },
    { key: "status", label: "Status", render: (d) => <span className={`badge ${ALERT_STATUS[d.status]?.badge || ""}`}>{ALERT_STATUS[d.status]?.label || d.status}</span> },
    { key: "opened", label: "Dibuka", render: (d) => date(d.opened_at) },
  ];

  const canDecide = detail && !detail.error && detail.milestone?.can_decide;

  return (
    <>
      <h1 className="t-h1 mb-4">Laporan & Sengketa</h1>
      <p className="t-body muted mb-20">Sengketa hasil kerja yang diajukan setelah jatah revisi habis. Putuskan cairkan ke mahasiswa atau kembalikan untuk diperbaiki.</p>

      <div className="row gap-8 mb-16" style={{ flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f.id || "all"} type="button" className={`chip-filter ${filter === f.id ? "active" : ""}`} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {loadError && <div className="card card-pad mb-16" role="alert" style={{ color: "var(--error)" }}>{loadError}</div>}
      {rows === null && !loadError ? (
        <div className="empty-state">Memuat sengketa…</div>
      ) : (
        <DataTable columns={columns} rows={rows || []} onRowClick={(d) => setActiveId(d.id)} empty="Tidak ada sengketa." />
      )}

      <Drawer open={!!activeId} onClose={() => setActiveId(null)} title={detail?.project?.title || "Sengketa"}>
        {!detail ? (
          <div className="empty-state">Memuat detail…</div>
        ) : detail.error ? (
          <div className="empty-state" role="alert">{detail.error}</div>
        ) : (
          <div className="job-detail">
            <div className="row-between">
              <span className={`badge ${ALERT_STATUS[detail.status]?.badge || ""}`}>{ALERT_STATUS[detail.status]?.label || detail.status}</span>
              <span className="t-caption">{detail.contract?.contract_no}</span>
            </div>
            <div className="t-small mt-8"><b>{requester(detail)}</b> ({detail.requester_role === "STUDENT" ? "mahasiswa" : "UMKM"}) terhadap <b>{against(detail)}</b></div>
            <div className="card card-pad mt-12"><div className="t-caption">ALASAN</div><div className="t-small mt-4">{detail.reason || "—"}</div></div>

            <div className="t-small mt-12">
              Milestone {detail.milestone.sequence}: <b>{detail.milestone.title}</b> · {formatRupiah(detail.milestone.amount)} · revisi {detail.milestone.revision_count}/{detail.milestone.max_revisions}
            </div>
            {detail.resolution_notes && <div className="t-small muted mt-8">Keputusan: {detail.resolution_notes} ({date(detail.resolved_at)})</div>}

            <div className="divider" />
            <div className="t-caption mb-8">RIWAYAT PENGAJUAN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {detail.history.map((h) => (
                <div key={h.version} className="card card-pad">
                  <div className="row-between"><b className="t-small">Versi {h.version}</b><span className="t-caption">{date(h.submitted_at)}</span></div>
                  {h.files.length > 0 && <div className="t-caption mt-4">{h.files.join(", ")}</div>}
                  {h.reviews.map((r, i) => (
                    <div key={i} className="t-small mt-6">
                      <b>{REVIEWER[r.reviewer_role] || r.reviewer_role}:</b> {REVIEW_DECISION[r.decision] || r.decision}{r.feedback ? ` — ${r.feedback}` : ""}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {canDecide && (
              <div className="drawer-footer row gap-10">
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirm("return")}>Kembalikan untuk diperbaiki</button>
                <button type="button" className="btn btn-primary btn-block" onClick={() => setConfirm("release")}>Cairkan ke mahasiswa</button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirm && !!detail?.milestone} onClose={() => setConfirm(null)}
        title={confirm === "release" ? "Cairkan dana ke mahasiswa?" : "Kembalikan ke mahasiswa?"}
        confirmLabel={confirm === "release" ? "Ya, cairkan" : "Ya, kembalikan"}
        reason={confirm === "release" ? "optional" : "required"} reasonLabel="Catatan keputusan"
        onConfirm={decide}
      >
        {confirm === "release"
          ? <>Milestone disetujui admin dan <b>{formatRupiah(detail?.milestone?.amount || 0)}</b> dicairkan ke <b>{detail?.student?.name}</b>. Sengketa ditutup.</>
          : <>Milestone kembali dikerjakan <b>{detail?.student?.name}</b> tanpa menambah hitungan revisi UMKM. Dana tetap ditahan.</>}
      </ConfirmDialog>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
