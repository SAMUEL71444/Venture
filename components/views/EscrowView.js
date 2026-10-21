"use client";

import { useCallback, useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import DataTable from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { adminApi } from "@/lib/admin/api";
import { formatRupiah, formatTanggal } from "@/lib/format";

const FILTERS = [
  { id: "", label: "Semua Status" },
  { id: "held", label: "Ditahan" },
  { id: "released", label: "Dicairkan" },
  { id: "refunded", label: "Dikembalikan" },
  { id: "settled", label: "Diselesaikan" },
];
const ESCROW_STATUS = {
  PENDING_FUNDING: { label: "Belum didanai", badge: "" },
  HELD: { label: "Ditahan", badge: "badge-warning" },
  PARTIALLY_RELEASED: { label: "Ditahan (sebagian cair)", badge: "badge-warning" },
  RELEASED: { label: "Dicairkan", badge: "badge-success" },
  REFUNDED: { label: "Dikembalikan", badge: "badge-info" },
  SETTLED: { label: "Diselesaikan", badge: "badge-info" },
};
const MILESTONE_STATUS = {
  LOCKED: "Belum mulai", IN_PROGRESS: "Dikerjakan", MENTOR_REVIEW: "Review mentor", CLIENT_REVIEW: "Review UMKM",
  REVISION_REQUESTED: "Revisi", ESCALATED: "Sengketa", APPROVED: "Cair", CANCELLED: "Dibatalkan",
};
const SETTLED_MILESTONE = ["APPROVED", "CANCELLED"];
const date = (iso) => (iso ? formatTanggal(iso.slice(0, 10)) : "—");

// Transaksi & Dana: dana escrow per kontrak dari GET /admin/escrows.
// - Cairkan  → POST /admin/milestones/{id}/force-approve (hanya milestone sengketa)
// - Kembalikan → POST /admin/contracts/{id}/terminate (sisa dana ke UMKM)
// - Bekukan  → belum ada di backend (dinonaktifkan, "Segera hadir")
// Pelaku tiap keputusan dicatat backend di audit log.
export default function EscrowView() {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "release", milestone } | { kind: "refund" }
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const res = await adminApi.escrows({ page, per_page: 20, ...(filter ? { status: filter } : {}) });
    if (!res.ok) {
      setLoadError(res.error.message);
      return;
    }
    setLoadError(null);
    setRows(res.data);
    setMeta(res.meta);
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  const active = (rows || []).find((r) => r.id === activeId) || null;
  const refundable = active ? active.milestones.filter((m) => !SETTLED_MILESTONE.includes(m.status)) : [];
  const refundTotal = refundable.reduce((sum, m) => sum + m.amount, 0);

  function done(message) {
    setConfirm(null);
    setToast(message);
    setTimeout(() => setToast(null), 2600);
    load();
  }

  async function runConfirm(reason) {
    if (confirm.kind === "release") {
      const res = await adminApi.forceApprove(confirm.milestone.id, reason);
      if (res.ok) done(`${formatRupiah(confirm.milestone.amount)} dicairkan ke ${active.student?.name}.`);
      return res;
    }
    const allocations = refundable.map((m) => ({ milestone_id: m.id, amount_to_student: 0, amount_to_umkm: m.amount }));
    const res = await adminApi.terminateContract(active.contract.id, allocations, reason);
    if (res.ok) done(`${formatRupiah(refundTotal)} dikembalikan ke ${active.umkm?.name}.`);
    return res;
  }

  const columns = [
    { key: "umkm", label: "UMKM", render: (r) => r.umkm?.name || "—" },
    { key: "student", label: "Mahasiswa", render: (r) => r.student?.name || "—" },
    { key: "project", label: "Proyek", render: (r) => r.project?.title || "—" },
    { key: "amount", label: "Nominal", align: "right", render: (r) => formatRupiah(r.funded_amount) },
    { key: "status", label: "Status Dana", render: (r) => <span className={`badge ${ESCROW_STATUS[r.status]?.badge || ""}`}>{ESCROW_STATUS[r.status]?.label || r.status}</span> },
    { key: "date", label: "Diperbarui", render: (r) => date(r.updated_at) },
  ];

  return (
    <>
      <h1 className="t-h1 mb-4">Transaksi & Dana</h1>
      <p className="t-body muted mb-20">Pantau dan, kalau perlu, intervensi status dana escrow tiap kontrak.</p>

      <div className="row gap-8 mb-16" style={{ flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button key={f.id || "all"} type="button" className={`chip-filter ${filter === f.id ? "active" : ""}`} onClick={() => { setFilter(f.id); setPage(1); }}>
            {f.label}
          </button>
        ))}
      </div>

      {loadError && <div className="card card-pad mb-16" role="alert" style={{ color: "var(--error)" }}>{loadError}</div>}

      {rows === null && !loadError ? (
        <div className="empty-state">Memuat dana escrow…</div>
      ) : (
        <DataTable columns={columns} rows={rows || []} onRowClick={(r) => setActiveId(r.id)} empty="Tidak ada dana dengan status ini." />
      )}

      {meta.last_page > 1 && (
        <div className="row-between mt-16">
          <span className="t-caption">Halaman {meta.current_page} dari {meta.last_page}</span>
          <div className="row gap-10">
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
          </div>
        </div>
      )}

      <Drawer open={!!active} onClose={() => setActiveId(null)} title={active?.project?.title || "Dana Escrow"}>
        {active && (
          <div className="job-detail">
            <div className="row-between">
              <span className={`badge ${ESCROW_STATUS[active.status]?.badge || ""}`}>{ESCROW_STATUS[active.status]?.label || active.status}</span>
              <span className="t-caption">{active.contract.contract_no}</span>
            </div>
            <div className="t-small muted mt-8">{active.umkm?.name} → {active.student?.name}</div>

            <div className="job-detail-stats mt-16">
              <div><div className="t-caption">DITAHAN</div><div className="t-h3 mt-4" style={{ fontSize: 16 }}>{formatRupiah(active.held_amount)}</div></div>
              <div><div className="t-caption">DICAIRKAN</div><div className="t-h3 mt-4" style={{ fontSize: 16 }}>{formatRupiah(active.released_amount)}</div></div>
              <div><div className="t-caption">DIKEMBALIKAN</div><div className="t-h3 mt-4" style={{ fontSize: 16 }}>{formatRupiah(active.refunded_amount)}</div></div>
            </div>

            <div className="divider" />
            <div className="t-caption mb-8">MILESTONE</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {active.milestones.map((m) => (
                <div key={m.id} className="card card-pad row-between" style={{ gap: 12 }}>
                  <div>
                    <div className="t-small" style={{ fontWeight: 600 }}>{m.sequence}. {m.title}</div>
                    <div className="t-caption">{formatRupiah(m.amount)} · {MILESTONE_STATUS[m.status] || m.status}</div>
                  </div>
                  {m.can_release && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setConfirm({ kind: "release", milestone: m })}>Cairkan</button>
                  )}
                </div>
              ))}
            </div>

            <div className="drawer-footer row gap-10" style={{ flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary btn-block" disabled title="Segera hadir">Bekukan · Segera hadir</button>
              {active.contract.can_refund && refundTotal > 0 && (
                <button type="button" className="btn btn-block" style={{ background: "var(--error)", color: "#fff" }} onClick={() => setConfirm({ kind: "refund" })}>
                  Kembalikan {formatRupiah(refundTotal)}
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirm && !!active} onClose={() => setConfirm(null)}
        title={confirm?.kind === "release" ? "Cairkan dana milestone?" : "Kembalikan dana ke UMKM?"}
        confirmLabel={confirm?.kind === "release" ? "Ya, cairkan" : "Ya, kembalikan"}
        danger={confirm?.kind === "refund"}
        reason={confirm?.kind === "release" ? "optional" : "required"}
        reasonLabel={confirm?.kind === "release" ? "Catatan keputusan" : "Alasan penghentian kontrak"}
        onConfirm={runConfirm}
      >
        {confirm?.kind === "release" ? (
          <>Milestone <b>{confirm.milestone.title}</b> disetujui admin dan <b>{formatRupiah(confirm.milestone.amount)}</b> dicairkan ke <b>{active?.student?.name}</b> (dipotong biaya platform). Sengketa milestone ini ditutup.</>
        ) : (
          <>Kontrak <b>{active?.contract.contract_no}</b> dihentikan dan <b>{formatRupiah(refundTotal)}</b> dari {refundable.length} milestone yang belum cair dikembalikan ke <b>{active?.umkm?.name}</b>.</>
        )}
      </ConfirmDialog>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
