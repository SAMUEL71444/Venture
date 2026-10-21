"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import Modal from "@/components/ui/Modal";
import { useProjects } from "@/context/ProjectsContext";
import { MOCK_TODAY } from "@/lib/projects.mock";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { milestoneLock, canAddMilestone, editsAmount, validateMilestone, newMilestone } from "@/lib/projects-posting";

const STATUS = {
  belum: { label: "Belum dimulai", badge: "badge-neutral" },
  berjalan: { label: "Berjalan", badge: "badge-info" },
  selesai: { label: "Menunggu review", badge: "badge-warning" },
  revisi: { label: "Revisi", badge: "badge-error" },
  disetujui: { label: "Disetujui", badge: "badge-success" },
};

// status dihitung ulang dari log event (lib/progress.js), tidak disimpan.
const clean = ({ status, ...rest }) => rest;

// Kelola milestone di drawer detail proyek (sudut pandang UMKM). Milestone
// yang sudah berjalan/disetujui, atau yang dananya sudah dijadwalkan di
// escrow, TERKUNCI (lihat milestoneLock) supaya struktur escrow tidak rusak.
// Proyek yang diposting lewat form bisa mengubah nominal juga; proyek bawaan
// hanya nama/deskripsi/tenggat karena anggarannya dikunci jadwal escrow.
export default function MilestoneManager({ project }) {
  const { saveMilestones } = useProjects();
  const [modal, setModal] = useState(null); // { mode: "add" | "edit" | "hapus", ms? }
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  const withAmount = editsAmount(project);
  const canAdd = canAddMilestone(project);
  const list = project.milestones;
  const opts = { requireAmount: withAmount, requireDeadline: withAmount };

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }
  const close = () => setModal(null);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  function openForm(mode, ms) {
    setDraft(ms ? { ...ms, amount: ms.amount ?? "" } : { ...newMilestone() });
    setErrors({});
    setModal({ mode, ms });
  }

  function save(e) {
    e.preventDefault();
    const errs = validateMilestone(draft, MOCK_TODAY, opts);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const item = {
      id: draft.id, name: draft.name.trim(), description: (draft.description || "").trim(),
      ...(draft.deadline ? { deadline: draft.deadline } : {}),
      ...(withAmount ? { amount: Number(draft.amount) } : {}),
    };
    const next = modal.mode === "edit"
      ? list.map((m) => (m.id === item.id ? { ...clean(m), ...item } : clean(m)))
      : [...list.map(clean), item];
    saveMilestones(project.id, next);
    close();
    showToast(modal.mode === "edit" ? "Milestone diperbarui." : "Milestone ditambahkan.");
  }

  function confirmDelete() {
    saveMilestones(project.id, list.filter((m) => m.id !== modal.ms.id).map(clean));
    close();
    showToast("Milestone dihapus.");
  }

  const fieldError = (k) => errors[k] && <div className="pp-error" role="alert">{errors[k]}</div>;

  return (
    <div className="mt-20">
      <div className="row-between mb-8">
        <div className="t-caption">MILESTONE</div>
        {canAdd && (
          <button type="button" className="link-btn row gap-6" onClick={() => openForm("add")}><Icon name="plus" /> Tambah Milestone</button>
        )}
      </div>

      <div className="ms-list">
        {list.map((m, i) => {
          const st = STATUS[m.status] || STATUS.belum;
          const lock = milestoneLock(project, m);
          return (
            <div key={m.id} className={`ms-row ${lock ? "locked" : ""}`}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                  <span className="t-small" style={{ fontWeight: 700 }}>{i + 1}. {m.name}</span>
                  <span className={`badge ${st.badge}`}>{st.label}</span>
                </div>
                {m.description && <div className="t-caption ms-desc">{m.description}</div>}
                <div className="ms-meta">
                  {m.deadline && <span><Icon name="calendar" /> {formatTanggal(m.deadline)}</span>}
                  {m.amount != null && <span><Icon name="wallet" /> {formatRupiah(m.amount)}</span>}
                </div>
                {lock && <div className="ms-lock"><Icon name="lock" /> {lock}</div>}
              </div>
              {!lock && (
                <div className="row gap-6" style={{ flexShrink: 0 }}>
                  <button type="button" className="fp-icon-btn" onClick={() => openForm("edit", m)} aria-label={`Edit milestone ${i + 1}`}><Icon name="pencil" /></button>
                  <button
                    type="button" className="fp-icon-btn danger" disabled={list.length <= 1}
                    title={list.length <= 1 ? "Minimal harus ada 1 milestone" : undefined}
                    onClick={() => setModal({ mode: "hapus", ms: m })} aria-label={`Hapus milestone ${i + 1}`}
                  ><Icon name="trash" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={modal?.mode === "add" || modal?.mode === "edit"} onClose={close} title={modal?.mode === "edit" ? "Edit Milestone" : "Tambah Milestone"} width={520}>
        <form onSubmit={save} noValidate className="mt-16">
          <div className="field">
            <label htmlFor="mm-name">Nama milestone</label>
            <input id="mm-name" className="input" value={draft.name || ""} onChange={set("name")} autoFocus />
            {fieldError("name")}
          </div>
          <div className="field">
            <label htmlFor="mm-desc">Deskripsi singkat</label>
            <input id="mm-desc" className="input" value={draft.description || ""} onChange={set("description")} />
          </div>
          <div className="pp-ms-grid" style={{ marginBottom: 18 }}>
            {withAmount && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="mm-amt">Nominal (Rp)</label>
                <input id="mm-amt" className="input" type="number" min="0" step="10000" value={draft.amount ?? ""} onChange={set("amount")} />
                {fieldError("amount")}
              </div>
            )}
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="mm-date">Tenggat{withAmount ? "" : " (opsional)"}</label>
              <input id="mm-date" className="input" type="date" min={MOCK_TODAY} value={draft.deadline || ""} onChange={set("deadline")} />
              {fieldError("deadline")}
            </div>
          </div>
          {!withAmount && <p className="t-caption" style={{ marginBottom: 14 }}>Nominal tidak diubah di sini — anggaran proyek ini sudah dikunci oleh jadwal escrow.</p>}
          <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={close}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal?.mode === "hapus"} onClose={close} title="Hapus Milestone?" width={460}>
        <p className="t-small muted mt-16 mb-16">
          {modal?.ms ? <>Milestone <b style={{ color: "var(--text)" }}>{modal.ms.name}</b> belum dimulai dan belum punya dana di escrow, jadi aman dihapus.</> : null}
        </p>
        <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={close}>Batal</button>
          <button type="button" className="btn btn-danger" onClick={confirmDelete}>Hapus</button>
        </div>
      </Modal>

      {toast && <div className="toast" style={{ zIndex: 400 }}>{toast}</div>}
    </div>
  );
}
