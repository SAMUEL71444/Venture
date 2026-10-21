"use client";

import { useState } from "react";
import Drawer from "@/components/ui/Drawer";
import FundStatusBadge from "./FundStatusBadge";
import { termsForProject, fundStatusOfTerm } from "@/lib/escrow";
import { activeReportProjectIds } from "@/lib/reports.mock";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { MOCK_TODAY } from "@/lib/projects.mock";
import { useEscrow } from "@/context/EscrowContext";
import { useRole } from "@/context/RoleContext";

const ACTION_LABELS = {
  cairkan: "Cairkan Manual",
  bekukan: "Bekukan Dana",
  kembalikan: "Kembalikan ke UMKM",
};

// Breakdown dana SEMUA milestone satu proyek + tombol aksi manual. Tiap aksi
// wajib alasan dan tercatat di log audit (EscrowContext) — siapa, kapan,
// alasan — sesuai permintaan "jejak audit".
export default function EscrowDetailDrawer({ project, open, onClose }) {
  const { actions, recordAction } = useEscrow();
  const { user } = useRole();
  const [pendingAction, setPendingAction] = useState(null); // { txId, action }
  const [reason, setReason] = useState("");

  const terms = project ? termsForProject(project.id) : [];
  const frozenProjectIds = activeReportProjectIds();
  const projectActions = actions.filter((a) => terms.some((t) => `${t.projectId}-${t.milestoneId}` === a.txId));

  function startAction(txId, action) {
    setPendingAction({ txId, action });
    setReason("");
  }

  function confirmAction() {
    if (!reason.trim()) return;
    // Ringkasan untuk log aktivitas terpusat (muncul di Aktivitas Terbaru
    // profil admin): "Bekukan Dana — <judul proyek>, Milestone N".
    const milestoneId = pendingAction.txId.slice(project.id.length + 1);
    const idx = project.milestones.findIndex((m) => m.id === milestoneId);
    const summary = `${ACTION_LABELS[pendingAction.action]} — ${project.title}, Milestone ${idx + 1}`;
    recordAction(pendingAction.txId, pendingAction.action, user.name, reason.trim(), summary);
    setPendingAction(null);
    setReason("");
  }

  return (
    <Drawer open={open} onClose={onClose} title={project ? project.title : "Detail Transaksi"}>
      {project && (
        <div className="job-detail">
          <div className="t-small muted">{project.client} · Freelancer: {project.freelancerName || "Nadia Putri"}</div>

          <div className="divider" />

          <div className="t-caption mb-8">DANA PER MILESTONE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {terms.map((t) => {
              const idx = project.milestones.findIndex((m) => m.id === t.milestoneId);
              const milestone = project.milestones[idx];
              const status = fundStatusOfTerm(t, project, MOCK_TODAY, { actions, frozenProjectIds });
              const amount = Math.round(project.budget * t.persen);
              const txId = `${t.projectId}-${t.milestoneId}`;
              const isPending = pendingAction?.txId === txId;

              return (
                <div key={txId} className="card card-pad">
                  <div className="row-between">
                    <span className="t-small" style={{ fontWeight: 700 }}>Milestone {idx + 1}: {milestone?.name}</span>
                    <FundStatusBadge status={status} />
                  </div>
                  <div className="t-small muted mt-4">{formatRupiah(amount)} · {t.metode}</div>

                  {isPending ? (
                    <div className="mt-12">
                      <label className="t-caption mb-4" style={{ display: "block" }}>ALASAN {ACTION_LABELS[pendingAction.action].toUpperCase()}</label>
                      <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wajib diisi..." />
                      <div className="row gap-8 mt-8">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPendingAction(null)}>Batal</button>
                        <button type="button" className="btn btn-primary btn-sm" disabled={!reason.trim()} onClick={confirmAction}>
                          Konfirmasi
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="row gap-8 mt-12" style={{ flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startAction(txId, "cairkan")}>Cairkan Manual</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startAction(txId, "bekukan")}>Bekukan Dana</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => startAction(txId, "kembalikan")}>Kembalikan ke UMKM</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {projectActions.length > 0 && (
            <>
              <div className="divider" />
              <div className="t-caption mb-8">LOG AUDIT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {projectActions.map((a, i) => (
                  <div key={i} className="t-caption" style={{ lineHeight: 1.5 }}>
                    <b>{ACTION_LABELS[a.action]}</b> oleh {a.by} — {a.reason}
                    <div style={{ color: "var(--text-faint)" }}>{formatTanggal(a.at.slice(0, 10))}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
