"use client";

import { useCallback, useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import DataTable from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { adminApi } from "@/lib/admin/api";
import { formatTanggal } from "@/lib/format";

// Alert kualitas kerja (sengketa ada di Laporan & Sengketa, pembatalan di alurnya sendiri).
const QUALITY_TYPES = {
  MENTOR_OVERDUE: "Mentor terlambat mereview",
  STUDENT_OVERDUE: "Mahasiswa melewati tenggat",
  STUDENT_NOT_STARTED: "Mahasiswa belum mulai",
  UMKM_UNRESPONSIVE: "UMKM tidak merespons review",
  MENTOR_RETURN_LIMIT: "Batas pengembalian mentor habis",
};
const ALERT_STATUS = {
  OPEN: { label: "Baru", badge: "badge-warning" },
  FOLLOWED_UP: { label: "Ditindaklanjuti", badge: "badge-info" },
  AWAITING_DECISION: { label: "Menunggu keputusan", badge: "badge-warning" },
  RESOLVED: { label: "Selesai", badge: "badge-success" },
};
const SEVERITY = { HIGH: "Tinggi", MEDIUM: "Sedang", LOW: "Rendah" };
const CHANNELS = { WHATSAPP: "WhatsApp", TELEPON: "Telepon", EMAIL: "Email" };
const OUTCOMES = { TIDAK_DIANGKAT: "Tidak diangkat", DIJAWAB_AKAN_REVIEW: "Dijawab, akan direview", DIJAWAB_MENOLAK: "Dijawab, menolak", LAINNYA: "Lainnya" };
const MILESTONE_STATUS = {
  IN_PROGRESS: "Dikerjakan", MENTOR_REVIEW: "Review mentor", CLIENT_REVIEW: "Review UMKM", ESCALATED: "Eskalasi ke admin", APPROVED: "Disetujui",
};
const date = (iso) => (iso ? formatTanggal(String(iso).slice(0, 10)) : "—");

// Aksi milestone yang tersedia per jenis alert (aturan lengkap tetap di backend).
const ACTIONS = {
  followUp: { label: "Catat tindak lanjut", reason: "optional", reasonLabel: "Catatan" },
  reassign: { label: "Ganti mentor", reason: "none" },
  extraChance: { label: "Beri kesempatan tambahan", reason: "optional", reasonLabel: "Catatan" },
  forward: { label: "Teruskan ke UMKM", reason: "optional", reasonLabel: "Catatan" },
  forceApprove: { label: "Setujui & cairkan", reason: "optional", reasonLabel: "Catatan keputusan" },
  returnToStudent: { label: "Kembalikan ke mahasiswa", reason: "required", reasonLabel: "Catatan perbaikan" },
};

// Kualitas Kerja: alert dari GET /admin/alerts (+ detail GET /admin/alerts/{id}).
// Tindakan memakai endpoint yang ada: follow up (POST /admin/alerts/{id}/follow-ups)
// dan keputusan milestone (POST /admin/milestones/{id}/...). Pelaku dicatat backend.
export default function QualityView() {
  const [showResolved, setShowResolved] = useState(false);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [action, setAction] = useState(null);
  const [followUp, setFollowUp] = useState({ channel: "WHATSAPP", outcome: "TIDAK_DIANGKAT" });
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const res = await adminApi.alerts({ per_page: 50, ...(showResolved ? { status: "RESOLVED" } : {}) });
    if (!res.ok) {
      setLoadError(res.error.message);
      return;
    }
    setLoadError(null);
    setRows(res.data.filter((a) => QUALITY_TYPES[a.type]));
  }, [showResolved]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (id) => {
    setDetail(null);
    const res = await adminApi.alert(id);
    setDetail(res.ok ? res.data : { error: res.error.message });
  }, []);

  useEffect(() => {
    if (activeId) loadDetail(activeId);
  }, [activeId, loadDetail]);

  const alert = detail?.alert;
  const milestone = alert?.reference_type === "MILESTONE" ? detail?.reference : null;
  const open = alert && alert.status !== "RESOLVED";
  const available = !open ? [] : [
    // Backend hanya mencatat tindak lanjut untuk alert UMKM_UNRESPONSIVE.
    ...(alert.type === "UMKM_UNRESPONSIVE" && (alert.status === "OPEN" || alert.status === "FOLLOWED_UP") ? ["followUp"] : []),
    ...(milestone && alert.type === "MENTOR_OVERDUE" && milestone.status === "MENTOR_REVIEW" ? ["reassign"] : []),
    ...(milestone?.status === "ESCALATED" && alert.type === "MENTOR_RETURN_LIMIT" ? ["extraChance", "forward"] : []),
    ...(milestone?.status === "ESCALATED" ? ["forceApprove", "returnToStudent"] : []),
  ];

  async function run(notes) {
    const id = milestone?.id;
    const res = {
      followUp: () => adminApi.followUp(alert.id, { ...followUp, notes: notes || null }),
      reassign: () => adminApi.reassignMentor(id),
      extraChance: () => adminApi.extraChance(id, notes),
      forward: () => adminApi.forwardToClient(id, notes),
      forceApprove: () => adminApi.forceApprove(id, notes),
      returnToStudent: () => adminApi.returnToStudent(id, notes),
    }[action];
    const result = await res();
    if (!result.ok) return result;
    setToast(`${ACTIONS[action].label}: berhasil.`);
    setTimeout(() => setToast(null), 2600);
    setAction(null);
    loadDetail(alert.id);
    load();
    return result;
  }

  const columns = [
    { key: "type", label: "Jenis", render: (a) => <span style={{ fontWeight: 700 }}>{QUALITY_TYPES[a.type]}</span> },
    { key: "severity", label: "Tingkat", render: (a) => SEVERITY[a.severity] || a.severity },
    { key: "status", label: "Status", render: (a) => <span className={`badge ${ALERT_STATUS[a.status]?.badge || ""}`}>{ALERT_STATUS[a.status]?.label || a.status}</span> },
    { key: "created", label: "Dibuat", render: (a) => date(a.created_at) },
    { key: "deadline", label: "Tenggat tindak lanjut", render: (a) => date(a.follow_up_deadline) },
  ];

  return (
    <>
      <h1 className="t-h1 mb-4">Kualitas Kerja</h1>
      <p className="t-body muted mb-20">Peringatan kualitas pengerjaan: tenggat terlewat, review tertunda, dan UMKM yang tidak merespons.</p>

      <div className="row gap-8 mb-16">
        <button type="button" className={`chip-filter ${!showResolved ? "active" : ""}`} onClick={() => setShowResolved(false)}>Perlu tindakan</button>
        <button type="button" className={`chip-filter ${showResolved ? "active" : ""}`} onClick={() => setShowResolved(true)}>Selesai</button>
      </div>

      {loadError && <div className="card card-pad mb-16" role="alert" style={{ color: "var(--error)" }}>{loadError}</div>}
      {rows === null && !loadError ? (
        <div className="empty-state">Memuat alert…</div>
      ) : (
        <DataTable columns={columns} rows={rows || []} onRowClick={(a) => setActiveId(a.id)} empty="Tidak ada alert kualitas." />
      )}

      <Drawer open={!!activeId} onClose={() => setActiveId(null)} title={alert ? QUALITY_TYPES[alert.type] : "Alert"}>
        {!detail ? (
          <div className="empty-state">Memuat detail…</div>
        ) : detail.error ? (
          <div className="empty-state" role="alert">{detail.error}</div>
        ) : (
          <div className="job-detail">
            <div className="row-between">
              <span className={`badge ${ALERT_STATUS[alert.status]?.badge || ""}`}>{ALERT_STATUS[alert.status]?.label || alert.status}</span>
              <span className="t-caption">Dibuat {date(alert.created_at)}</span>
            </div>
            {milestone && (
              <div className="card card-pad mt-12">
                <div className="t-caption">MILESTONE · {milestone.contract?.contract_no}</div>
                <div className="t-small mt-4"><b>{milestone.title}</b> · {MILESTONE_STATUS[milestone.status] || milestone.status}</div>
              </div>
            )}
            {alert.resolution_notes && <div className="t-small muted mt-8">Penyelesaian: {alert.resolution_notes}</div>}

            {(alert.follow_ups || []).length > 0 && (
              <>
                <div className="divider" />
                <div className="t-caption mb-8">RIWAYAT TINDAK LANJUT</div>
                {alert.follow_ups.map((f) => (
                  <div key={f.id} className="t-small mb-6">{date(f.created_at)} · {CHANNELS[f.channel] || f.channel} · {OUTCOMES[f.outcome] || f.outcome}{f.notes ? ` — ${f.notes}` : ""}</div>
                ))}
              </>
            )}

            {available.length > 0 && (
              <div className="drawer-footer" style={{ display: "grid", gap: 10 }}>
                {available.map((key) => (
                  <button key={key} type="button" className={`btn btn-block ${key === "forceApprove" || key === "followUp" ? "btn-primary" : "btn-secondary"}`} onClick={() => setAction(key)}>
                    {ACTIONS[key].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!action} onClose={() => setAction(null)} title={action ? `${ACTIONS[action].label}?` : ""}
        confirmLabel="Ya, lanjutkan" reason={action ? ACTIONS[action].reason : "none"} reasonLabel={action ? ACTIONS[action].reasonLabel : ""}
        onConfirm={run}
      >
        {action === "followUp" ? (
          <div className="row gap-10" style={{ flexWrap: "wrap" }}>
            <select className="input" aria-label="Kanal" value={followUp.channel} onChange={(e) => setFollowUp((f) => ({ ...f, channel: e.target.value }))}>
              {Object.entries(CHANNELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="input" aria-label="Hasil" value={followUp.outcome} onChange={(e) => setFollowUp((f) => ({ ...f, outcome: e.target.value }))}>
              {Object.entries(OUTCOMES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ) : (
          <>Tindakan ini mengubah status milestone <b>{milestone?.title}</b> dan dicatat atas nama akunmu.</>
        )}
      </ConfirmDialog>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
