"use client";

import { useState } from "react";
import ProfileSection from "./ProfileSection";
import Icon from "@/components/Icon";

// Keahlian: chip skill. Pensil = mode edit (tambah/hapus chip). Di bawahnya
// ajakan asesmen gaya kerja (aksi cuma toast — belum ada fiturnya).
export default function SkillsSection({ id, skills, onChange, editable, showToast }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function add(e) {
    e.preventDefault();
    const v = draft.trim();
    if (!v || skills.some((s) => s.toLowerCase() === v.toLowerCase())) return setDraft("");
    onChange([...skills, v], "Keahlian ditambahkan.");
    setDraft("");
  }

  return (
    <ProfileSection id={id} title="Keahlian" editable={editable} onEdit={() => setEditing((v) => !v)}>
      <div className="row mt-12" style={{ flexWrap: "wrap", gap: 8 }}>
        {skills.map((s) => (
          <span key={s} className="chip row gap-6">
            {s}
            {editing && editable && (
              <button type="button" className="fp-chip-x" aria-label={`Hapus ${s}`} onClick={() => onChange(skills.filter((x) => x !== s), "Keahlian dihapus.")}>×</button>
            )}
          </span>
        ))}
      </div>

      {editing && editable && (
        <form className="row gap-8 mt-12 fp-fresh" onSubmit={add}>
          <input className="input" placeholder="Tambah keahlian…" value={draft} onChange={(e) => setDraft(e.target.value)} style={{ maxWidth: 240 }} />
          <button type="submit" className="btn btn-primary btn-sm">Tambah</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Selesai</button>
        </form>
      )}

      <div className="fp-callout mt-16">
        <Icon name="lightbulb" />
        <span className="t-small">
          Bantu UMKM melihat kenapa kamu cocok dan tingkatkan peluang terpilih dengan menyorot gaya kerja & soft skill-mu.{" "}
          <button type="button" className="link-btn" onClick={() => showToast("Asesmen gaya kerja belum tersedia di prototipe ini.")}>Ikuti asesmen</button>
        </span>
      </div>
    </ProfileSection>
  );
}
