"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import Modal from "@/components/ui/Modal";
import ProjectCard from "@/components/projects/ProjectCard";
import { useProjects } from "@/context/ProjectsContext";
import { MOCK_TODAY } from "@/lib/projects.mock";
import { enrichProject } from "@/lib/progress";
import { formatRupiah, formatTanggal } from "@/lib/format";
import {
  CATEGORIES, PRICE_TYPES, SKILL_OPTIONS, emptyDraft, newMilestone, validateDraft,
  buildPostedProject, sumAmounts,
} from "@/lib/projects-posting";

const STEPS = ["Info Dasar", "Milestone & Anggaran", "Review & Posting"];

// Modal "Buat Proyek Baru" — wizard 3 langkah memakai Modal & indikator
// .wizard-head yang sudah ada. Draft cuma hidup selama modal terbuka. Proyek
// jadi dengan status "terbuka" lewat buildPostedProject() (lib/projects-
// posting.js) dan disimpan ke ProjectsContext; preview di langkah 3 memakai
// ProjectCard yang sama dengan daftar proyek.
export default function PostProjectModal({ open, onClose, umkmName, onPosted }) {
  const { addProject } = useProjects();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const [touched, setTouched] = useState({ 0: false, 1: false });
  const [skillInput, setSkillInput] = useState("");

  // Mulai dari form kosong tiap kali modal dibuka.
  useEffect(() => {
    if (open) {
      setStep(0);
      setDraft(emptyDraft());
      setTouched({ 0: false, 1: false });
      setSkillInput("");
    }
  }, [open]);

  const v = useMemo(() => validateDraft(draft, MOCK_TODAY), [draft]);
  const touch = () => setTouched((t) => ({ ...t, [step]: true }));
  const set = (patch) => { touch(); setDraft((d) => ({ ...d, ...patch })); };

  function toggleSkill(skill) {
    set({ skills: draft.skills.includes(skill) ? draft.skills.filter((s) => s !== skill) : [...draft.skills, skill] });
  }
  function addCustomSkill(e) {
    e.preventDefault();
    const s = skillInput.trim();
    if (s && !draft.skills.some((x) => x.toLowerCase() === s.toLowerCase())) set({ skills: [...draft.skills, s] });
    setSkillInput("");
  }

  const setMilestone = (id, patch) => set({ milestones: draft.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const addMilestone = () => set({ milestones: [...draft.milestones, newMilestone()] });
  const removeMilestone = (id) => set({ milestones: draft.milestones.filter((m) => m.id !== id) });

  const preview = useMemo(
    () => (step === 2 && v.ok ? enrichProject(buildPostedProject(draft, umkmName, MOCK_TODAY), MOCK_TODAY) : null),
    [step, v.ok, draft, umkmName]
  );

  function submit() {
    if (!v.ok) return;
    const project = buildPostedProject(draft, umkmName, MOCK_TODAY);
    addProject(project);
    onPosted?.(project);
    onClose();
  }

  const allSkills = [...SKILL_OPTIONS, ...draft.skills.filter((s) => !SKILL_OPTIONS.includes(s))];
  const hourly = draft.priceType === "Per Jam";
  const canNext = step === 0 ? v.step1Ok : step === 1 ? v.step2Ok : v.ok;
  const showErrors = touched[step];

  return (
    <Modal open={open} onClose={onClose} title="Buat Proyek Baru" width={760}>
      <div className="wizard-head mt-16" style={{ marginBottom: 22 }}>
        {STEPS.map((label, i) => (
          <div key={label} className={`wizard-step ${i < step ? "done" : i === step ? "active" : ""}`}>
            <div className="circ">{i < step ? <Icon name="check" /> : i + 1}</div>
            {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="pp-body">
          <div className="field">
            <label htmlFor="pp-title">Judul proyek</label>
            <input id="pp-title" className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="mis. Desain Menu & Banner Promosi" autoFocus />
            {showErrors && v.titleError && <div className="pp-error" role="alert">{v.titleError}</div>}
          </div>
          <div className="field">
            <label htmlFor="pp-cat">Kategori / bidang</label>
            <select id="pp-cat" className="input" value={draft.category} onChange={(e) => set({ category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pp-desc">Deskripsi proyek</label>
            <textarea id="pp-desc" className="input" rows={4} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Jelaskan apa yang kamu butuhkan, contoh hasil yang diharapkan, dan hal penting lainnya." />
          </div>
          <div className="field">
            <label>Skill yang dibutuhkan</label>
            <div className="pp-skills">
              {allSkills.map((s) => (
                <button key={s} type="button" className={`chip-filter ${draft.skills.includes(s) ? "active" : ""}`} onClick={() => toggleSkill(s)} aria-pressed={draft.skills.includes(s)}>
                  {s}
                </button>
              ))}
            </div>
            <form className="row gap-8 mt-8" onSubmit={addCustomSkill}>
              <input className="input" style={{ maxWidth: 260 }} placeholder="Tambah skill baru…" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} aria-label="Tambah skill baru" />
              <button type="submit" className="btn btn-secondary btn-sm">Tambah</button>
            </form>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Jenis harga</label>
            <div className="pp-price">
              {PRICE_TYPES.map((t) => (
                <label key={t} className={`radio-card ${draft.priceType === t ? "selected" : ""}`}>
                  <input type="radio" name="pp-price" checked={draft.priceType === t} onChange={() => set({ priceType: t })} style={{ marginTop: 3 }} />
                  <div>
                    <div className="settings-item-title">{t}</div>
                    <div className="t-caption settings-item-sub">{t === "Harga Tetap" ? "Nominal per milestone sudah pasti." : "Nominal menjadi estimasi anggaran per milestone."}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="pp-body">
          <p className="t-small muted" style={{ marginBottom: 12 }}>
            Pecah proyek jadi milestone. Dana tiap milestone ditahan di escrow dan baru cair setelah kamu menyetujui hasilnya. Milestone bisa diubah lagi setelah proyek dibuat.
          </p>
          <div className="pp-milestones">
            {draft.milestones.map((m, i) => {
              const err = v.milestoneErrors[m.id] || {};
              return (
                <div key={m.id} className="pp-ms-card">
                  <div className="row-between mb-8">
                    <span className="settings-item-title">Milestone {i + 1}</span>
                    <button
                      type="button" className="fp-icon-btn danger" disabled={draft.milestones.length <= 1}
                      onClick={() => removeMilestone(m.id)} aria-label={`Hapus milestone ${i + 1}`}
                      title={draft.milestones.length <= 1 ? "Minimal harus ada 1 milestone" : "Hapus milestone"}
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label htmlFor={`ms-name-${m.id}`}>Nama milestone</label>
                    <input id={`ms-name-${m.id}`} className="input" value={m.name} onChange={(e) => setMilestone(m.id, { name: e.target.value })} placeholder="mis. Konsep logo" />
                    {showErrors && err.name && <div className="pp-error" role="alert">{err.name}</div>}
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label htmlFor={`ms-desc-${m.id}`}>Deskripsi singkat</label>
                    <input id={`ms-desc-${m.id}`} className="input" value={m.description} onChange={(e) => setMilestone(m.id, { description: e.target.value })} />
                  </div>
                  <div className="pp-ms-grid">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor={`ms-amt-${m.id}`}>{hourly ? "Estimasi nominal (Rp)" : "Nominal (Rp)"}</label>
                      <input id={`ms-amt-${m.id}`} className="input" type="number" min="0" step="10000" inputMode="numeric" value={m.amount} onChange={(e) => setMilestone(m.id, { amount: e.target.value })} />
                      {showErrors && err.amount && <div className="pp-error" role="alert">{err.amount}</div>}
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label htmlFor={`ms-date-${m.id}`}>Tenggat</label>
                      <input id={`ms-date-${m.id}`} className="input" type="date" min={MOCK_TODAY} value={m.deadline} onChange={(e) => setMilestone(m.id, { deadline: e.target.value })} />
                      {showErrors && err.deadline && <div className="pp-error" role="alert">{err.deadline}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={addMilestone}><Icon name="plus" /> Tambah Milestone</button>

          <div className="pp-total">
            <span>{hourly ? "Total estimasi anggaran" : "Total anggaran"}</span>
            <b>{formatRupiah(sumAmounts(draft.milestones))}</b>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="pp-body">
          <p className="t-small muted" style={{ marginBottom: 12 }}>Seperti inilah proyekmu akan tampil di daftar Proyek.</p>
          <div className="job-feed-list">
            <ProjectCard project={preview} onOpenDetail={() => {}} perspective="client" />
          </div>
          <div className="pp-review">
            <div className="t-caption">JENIS HARGA</div>
            <div className="t-small" style={{ fontWeight: 600 }}>{draft.priceType}</div>
            {draft.skills.length > 0 && (
              <>
                <div className="t-caption mt-12">SKILL DIBUTUHKAN</div>
                <div className="row mt-4" style={{ flexWrap: "wrap", gap: 6 }}>{draft.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>
              </>
            )}
            <div className="t-caption mt-12">MILESTONE ({preview.milestones.length})</div>
            <div className="pp-review-list">
              {preview.milestones.map((m, i) => (
                <div key={m.id} className="row-between">
                  <span className="t-small">{i + 1}. {m.name} <span className="muted">· {formatTanggal(m.deadline)}</span></span>
                  <span className="t-small" style={{ fontWeight: 700 }}>{formatRupiah(m.amount)}</span>
                </div>
              ))}
            </div>
            <div className="pp-total" style={{ marginTop: 12 }}>
              <span>{hourly ? "Total estimasi anggaran" : "Total anggaran"}</span>
              <b>{formatRupiah(preview.budget)}</b>
            </div>
          </div>
        </div>
      )}

      <div className="row gap-8" style={{ justifyContent: "flex-end", marginTop: 22 }}>
        {step === 0
          ? <button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button>
          : <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}>Kembali</button>}
        {step < 2 ? (
          <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Berikutnya</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={!v.ok} onClick={submit}>Posting Proyek</button>
        )}
      </div>
    </Modal>
  );
}
