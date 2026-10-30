"use client";

import { useState } from "react";

// Bagian kecil untuk card Profil/Pengaturan yang memakai data asli (GET/PUT /me/profile).

/** Satu baris data read-only; `note` = keterangan kecil (mis. kenapa tidak bisa diubah). */
export function InfoRow({ label, children, note }) {
  return (
    <div className="settings-field">
      <span className="t-caption">{label}</span>
      <div style={{ minWidth: 0 }}>
        <div className="t-small" style={{ overflowWrap: "anywhere" }}>{children ?? "-"}</div>
        {note && <div className="t-caption muted mt-4">{note}</div>}
      </div>
    </div>
  );
}

/** Kosong → null (field nullable di backend); angka → number. */
function toPayload(fields, draft) {
  return Object.fromEntries(fields.map((f) => {
    const raw = draft[f.key];
    if (f.type === "number") return [f.key, raw === "" || raw == null ? null : Number(raw)];
    const value = typeof raw === "string" ? raw.trim() : raw;
    return [f.key, value === "" && !f.required ? null : value];
  }));
}

/**
 * Form edit inline. onSubmit(patch) → hasil profileApi ({ ok, error: { message, fields } });
 * pesan validasi dari backend ditampilkan di bawah field masing-masing.
 */
export function EditForm({ fields, initial, onCancel, onSubmit, submitLabel = "Simpan" }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? ""])));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const missing = fields.filter((f) => f.required && !String(draft[f.key] ?? "").trim());
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f.key, `${f.label} wajib diisi.`])));
      return;
    }
    setSaving(true);
    setErrors({});
    setFormError(null);
    const res = await onSubmit(toPayload(fields, draft));
    setSaving(false);
    if (!res.ok) {
      setErrors(res.error.fields || {});
      setFormError(res.error.message);
    }
  }

  return (
    <form className="mt-12" onSubmit={submit} noValidate>
      {fields.map((f) => {
        const id = `pf-${f.key}`;
        const props = {
          id, className: "input", value: draft[f.key] ?? "", placeholder: f.placeholder, maxLength: f.maxLength,
          "aria-invalid": errors[f.key] ? true : undefined,
          onChange: (e) => setDraft((d) => ({ ...d, [f.key]: e.target.value })),
        };
        return (
          <div className="field" key={f.key}>
            <label htmlFor={id}>{f.label}{f.required ? " *" : ""}</label>
            {f.type === "textarea" ? <textarea rows={4} {...props} />
              : f.type === "select" ? (
                <select {...props}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : <input type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"} min={f.min} max={f.max} {...props} />}
            {f.hint && !errors[f.key] && <div className="t-caption muted mt-4">{f.hint}</div>}
            {errors[f.key] && <div className="t-caption mt-4" style={{ color: "var(--error)" }} role="alert">{errors[f.key]}</div>}
          </div>
        );
      })}
      {formError && <div className="t-small mb-8" style={{ color: "var(--error)" }} role="alert">{formError}</div>}
      <div className="row gap-8">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={saving}>Batal</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Menyimpan…" : submitLabel}</button>
      </div>
    </form>
  );
}

/** Card untuk fitur yang belum punya endpoint: tanpa data contoh. */
export function ComingSoon({ title, children }) {
  return (
    <div className="card settings-card">
      <div className="settings-card-head">
        <h3 className="settings-card-title">{title}</h3>
        <span className="badge badge-neutral">Segera hadir</span>
      </div>
      <p className="t-small muted mt-8">{children}</p>
    </div>
  );
}

/** Pemuatan / galat pemuatan profil. */
export function LoadState({ loading, error, onRetry }) {
  if (loading) return <div className="card settings-card"><p className="t-small muted">Memuat data akun…</p></div>;
  return (
    <div className="card settings-card">
      <p className="t-small" role="alert">{error}</p>
      <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={onRetry}>Coba lagi</button>
    </div>
  );
}
