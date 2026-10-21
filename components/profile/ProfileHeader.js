"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { IconBtn } from "./ProfileSection";
import { formatRupiah } from "@/lib/format";
import { initials } from "@/lib/mock-data";

function useLocalTime(offset) {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () => setT(new Date(Date.now() + offset * 3600e3).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [offset]);
  return t;
}

// Header profil: identitas, lokasi + waktu lokal, aksi (tampilan publik,
// pengaturan, share), judul + tarif (edit inline), dan bio.
export default function ProfileHeader({ user, data, idVerified, editable, isPublic, onTogglePublic, onChange, showToast }) {
  const time = useLocalTime(data.timezoneOffset);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: data.title, rate: String(data.rate.amount), bio: data.bio });

  function startEdit() { setDraft({ title: data.title, rate: String(data.rate.amount), bio: data.bio }); setEditing(true); }
  function save(e) {
    e.preventDefault();
    const amount = Number(draft.rate.replace(/\D/g, "")) || 0;
    onChange({ title: draft.title.trim() || data.title, bio: draft.bio.trim() || data.bio, rate: { ...data.rate, amount } }, "Perubahan disimpan.");
    setEditing(false);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.origin + "/profile?view=public");
      showToast("Tautan profil disalin.");
    } catch {
      showToast("Tidak bisa menyalin tautan di browser ini.");
    }
  }

  return (
    <header className="fp-header">
      <div className="fp-header-top">
        <div className="row gap-16" style={{ minWidth: 0 }}>
          <div className="avatar avatar-lg" style={{ background: user.avatarBg || "var(--primary-light)", width: 72, height: 72, fontSize: 24, flexShrink: 0 }}>
            {initials(user.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="row gap-8" style={{ flexWrap: "wrap" }}>
              <h1 className="t-h1" style={{ fontSize: 22 }}>{user.name}</h1>
              {idVerified
                ? <span className="badge badge-success">Identitas Terverifikasi</span>
                : <Link href="/settings?tab=verifikasi" className="link-btn" style={{ fontSize: 12.5 }}>Verifikasi identitas kamu</Link>}
            </div>
            <div className="t-small muted mt-4 row gap-6" style={{ flexWrap: "wrap" }}>
              <Icon name="mapPin" /> {data.location}{time && <> · {time} waktu setempat</>}
            </div>
          </div>
        </div>

        <div className="fp-header-actions">
          {isPublic ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onTogglePublic}>Kembali ke Mode Edit</button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onTogglePublic}>Lihat Tampilan Publik</button>
              <Link href="/settings?tab=pengaturan-profil" className="btn btn-primary btn-sm">Pengaturan Profil</Link>
            </>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={share}><Icon name="arrowUpRight" /> Bagikan</button>
        </div>
      </div>

      {editing ? (
        <form className="fp-inline-form" onSubmit={save}>
          <div className="field"><label>Judul profesional</label><input className="input" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} /></div>
          <div className="field"><label>Tarif per jam (Rp)</label><input className="input" inputMode="numeric" value={draft.rate} onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))} /></div>
          <div className="field"><label>Bio singkat</label><textarea className="input" rows={3} value={draft.bio} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} /></div>
          <div className="row gap-8">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Batal</button>
            <button type="submit" className="btn btn-primary btn-sm">Simpan</button>
          </div>
        </form>
      ) : (
        <div className="fp-header-body">
          <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
            <div className="t-h3" style={{ fontSize: 17 }}>{data.title}</div>
            <div className="row gap-8">
              <span className="t-h3" style={{ fontSize: 16 }}>{data.rate.amount ? `${formatRupiah(data.rate.amount)}/${data.rate.unit}` : "Tarif belum diisi"}</span>
              {data.rate.amount > 0 && <span className="fp-check" aria-label="Tarif sudah diisi"><Icon name="check" /></span>}
              {editable && <IconBtn icon="pencil" label="Edit judul, tarif, dan bio" onClick={startEdit} />}
            </div>
          </div>
          <p className="t-small mt-8" style={{ maxWidth: 760 }}>{data.bio}</p>
        </div>
      )}
    </header>
  );
}
