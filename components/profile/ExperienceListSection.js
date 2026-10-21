"use client";

import { useState } from "react";
import ProfileSection, { IconBtn } from "./ProfileSection";

const BLANK = { title: "", org: "", period: "", desc: "" };

// Daftar item (judul, organisasi, periode, deskripsi) + form inline tambah/
// edit + hapus per item. Dipakai ulang untuk Riwayat Pekerjaan/Magang,
// Pengalaman Lain, dan Sertifikasi (lewat `labels` dan `emptyNode`).
export default function ExperienceListSection({
  id, title, items, onChange, editable, emptyNode, emptyText, addLabel,
  labels = { title: "Posisi / Judul", org: "Organisasi", period: "Periode", desc: "Deskripsi" },
}) {
  const [form, setForm] = useState(null); // null = tertutup; {id?, ...} = terbuka
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const next = form.id
      ? items.map((i) => (i.id === form.id ? form : i))
      : [{ ...form, id: `new-${Date.now()}`, fresh: true }, ...items];
    onChange(next, form.id ? "Perubahan disimpan." : "Item ditambahkan.");
    setForm(null);
  }

  return (
    <ProfileSection id={id} title={title} card editable={editable} addLabel={addLabel} onAdd={() => setForm({ ...BLANK })}>
      {form && (
        <form className="fp-inline-form" onSubmit={save}>
          <div className="field"><label>{labels.title}</label><input className="input" value={form.title} onChange={set("title")} autoFocus /></div>
          <div className="field"><label>{labels.org}</label><input className="input" value={form.org} onChange={set("org")} /></div>
          <div className="field"><label>{labels.period}</label><input className="input" value={form.period} onChange={set("period")} /></div>
          <div className="field"><label>{labels.desc}</label><textarea className="input" rows={2} value={form.desc} onChange={set("desc")} /></div>
          <div className="row gap-8">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(null)}>Batal</button>
            <button type="submit" className="btn btn-primary btn-sm">Simpan</button>
          </div>
        </form>
      )}

      {items.length === 0 && !form && (emptyNode || <p className="t-small muted mt-12">{emptyText || "Belum ada item."}</p>)}

      <div className="fp-list">
        {items.map((i) => (
          <div key={i.id} className={`fp-list-item ${i.fresh ? "fp-fresh" : ""}`}>
            <div style={{ minWidth: 0 }}>
              <div className="t-small" style={{ fontWeight: 700 }}>{i.title}</div>
              <div className="t-caption">{[i.org, i.period].filter(Boolean).join(" · ")}</div>
              {i.desc && <p className="t-small muted mt-4">{i.desc}</p>}
            </div>
            {editable && (
              <div className="row gap-8" style={{ flexShrink: 0 }}>
                <IconBtn icon="pencil" label={`Edit ${i.title}`} onClick={() => setForm({ ...i })} />
                <IconBtn icon="close" danger label={`Hapus ${i.title}`} onClick={() => onChange(items.filter((x) => x.id !== i.id), "Item dihapus.")} />
              </div>
            )}
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}
