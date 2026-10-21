"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { IconBtn } from "./ProfileSection";
import { getProfileCompleteness } from "@/lib/profile";

const HOURS = ["Kurang dari 10 jam/minggu", "Kurang dari 30 jam/minggu", "Lebih dari 30 jam/minggu"];

function Item({ id, title, done, children, onAdd, onEdit, editable, open, form }) {
  return (
    <div id={id} className="fp-side-item">
      <div className="row-between" style={{ gap: 8, alignItems: "flex-start" }}>
        <div className="row gap-8" style={{ alignItems: "flex-start", minWidth: 0 }}>
          <span className={`fp-check ${done ? "" : "empty"}`}>{done && <Icon name="check" />}</span>
          <div style={{ minWidth: 0 }}>
            <div className="t-small" style={{ fontWeight: 700 }}>{title}</div>
            {children}
          </div>
        </div>
        {editable && (
          <div className="row gap-6" style={{ flexShrink: 0 }}>
            {onEdit && <IconBtn icon="pencil" label={`Edit ${title}`} onClick={onEdit} />}
            {onAdd && <IconBtn icon="plus" label={`Tambah ${title}`} onClick={onAdd} />}
          </div>
        )}
      </div>
      {open && editable && <div className="fp-fresh mt-8">{form}</div>}
    </div>
  );
}

// Kolom kiri: banner, persentase kelengkapan, dan checklist item profil.
// Persentase & status "done" dihitung lewat lib/profile.js (getProfileCompleteness)
// — sumber yang SAMA dipakai widget dashboard (ProfileSidePanel), supaya
// angkanya tidak pernah menyimpang.
export default function CompletenessSidebar({ data, idVerified, onChange, showToast, editable }) {
  const [openKey, setOpenKey] = useState(null);
  const [text, setText] = useState({ a: "", b: "" });
  const toggle = (k) => { setText({ a: "", b: "" }); setOpenKey((c) => (c === k ? null : k)); };

  const { items: doneMap, pct } = getProfileCompleteness(data, idVerified);
  const done = Object.fromEntries(doneMap.map((i) => [i.key, i.done]));

  function addLanguage(e) {
    e.preventDefault();
    if (!text.a.trim()) return;
    onChange({ languages: [...data.languages, { name: text.a.trim(), level: text.b.trim() || "Dasar" }] }, "Bahasa ditambahkan.");
    setOpenKey(null);
  }
  function addEducation(e) {
    e.preventDefault();
    if (!text.a.trim()) return;
    onChange({ education: [...data.education, { id: `ed-${Date.now()}`, school: text.a.trim(), degree: text.b.trim(), years: "" }] }, "Pendidikan ditambahkan.");
    setOpenKey(null);
  }

  return (
    <aside className="fp-side">
      {editable && (
        <>
          <Link href="/settings?tab=verifikasi" className="fp-banner">
            <span className="t-small" style={{ fontWeight: 600 }}>Profil terverifikasi lebih sering muncul di pencarian UMKM.</span>
            <Icon name="arrowRight" />
          </Link>

          <div className="mt-16">
            <div className="row-between t-caption mb-4"><span>Kelengkapan profil</span><span>{pct}%</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, transition: "width 0.3s ease" }} /></div>
          </div>
        </>
      )}

      <div className="fp-side-list">
        <Item id="fp-item-video" title="Video Perkenalan" done={done.video} editable={editable} onAdd={() => showToast("Unggah video belum tersedia di prototipe ini.")} />

        <Item id="fp-item-hours" title="Jam Tersedia per Minggu" done={done.hours} editable={editable} onEdit={() => toggle("hours")} open={openKey === "hours"}
          form={
            <select className="input" value={data.hoursPerWeek} onChange={(e) => { onChange({ hoursPerWeek: e.target.value }, "Perubahan disimpan."); setOpenKey(null); }}>
              {HOURS.map((h) => <option key={h}>{h}</option>)}
            </select>
          }>
          <div className="t-caption">{data.hoursPerWeek}</div>
        </Item>

        <Item id="fp-item-languages" title="Bahasa" done={done.languages} editable={editable} onAdd={() => toggle("lang")} open={openKey === "lang"}
          form={
            <form className="row gap-6" onSubmit={addLanguage}>
              <input className="input" placeholder="Bahasa" value={text.a} onChange={(e) => setText((t) => ({ ...t, a: e.target.value }))} />
              <input className="input" placeholder="Level" value={text.b} onChange={(e) => setText((t) => ({ ...t, b: e.target.value }))} />
              <button type="submit" className="btn btn-primary btn-sm">OK</button>
            </form>
          }>
          {data.languages.map((l) => <div key={l.name} className="t-caption">{l.name}: {l.level}</div>)}
        </Item>

        <Item id="fp-item-verification" title="Verifikasi" done={done.verification}>
          <div className="t-caption">ID: {idVerified ? "Terverifikasi" : <>Belum · <Link href="/settings?tab=verifikasi" className="link-btn" style={{ fontSize: 12 }}>Verifikasi identitas</Link></>}</div>
          <div className="t-caption">Kartu Mahasiswa/NIM: {data.studentCardVerified ? "Terverifikasi" : "Belum diunggah"}</div>
        </Item>

        <Item id="fp-item-certs" title="Lisensi & Sertifikasi" done={done.certs} editable={editable} onAdd={() => showToast("Tambah sertifikasi lewat kartu Sertifikasi di bawah.")}>
          <div className="t-caption">{done.certs ? `${data.licenses.length + data.certifications.length} item` : "Belum ada"}</div>
        </Item>

        <Item id="fp-item-education" title="Pendidikan" done={done.education} editable={editable} onAdd={() => toggle("edu")} open={openKey === "edu"}
          form={
            <form className="row gap-6" onSubmit={addEducation}>
              <input className="input" placeholder="Kampus" value={text.a} onChange={(e) => setText((t) => ({ ...t, a: e.target.value }))} />
              <input className="input" placeholder="Jurusan / gelar" value={text.b} onChange={(e) => setText((t) => ({ ...t, b: e.target.value }))} />
              <button type="submit" className="btn btn-primary btn-sm">OK</button>
            </form>
          }>
          {data.education.map((ed) => (
            <div key={ed.id}>
              <div className="t-caption">{ed.school}</div>
              <div className="t-caption">{ed.degree}</div>
              {ed.years && <div className="t-caption">{ed.years}</div>}
            </div>
          ))}
        </Item>
      </div>
    </aside>
  );
}
