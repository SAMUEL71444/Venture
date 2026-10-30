"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import SettingsCard from "@/components/settings/SettingsCard";
import { ComingSoon, EditForm, InfoRow, LoadState } from "@/components/settings/ProfileForm";
import useMyProfile from "./useMyProfile";
import { initials } from "@/lib/mock-data";
import {
  ACCOUNT_STATUS, LEVELS, VERIFICATION_STATUS, formatJoined, levelLabel, profileApi,
} from "@/lib/profile/api";

// Profil mahasiswa dari data asli: GET /me/profile (identitas, kampus, ringkasan, skill,
// portofolio) + GET /students/me/certificates. Tidak ada data contoh: bagian kosong
// menampilkan ajakan "Lengkapi profil". Aksi hanya untuk operasi yang didukung backend:
// ringkasan & ketersediaan (PUT /me/profile), skill (PUT, ganti seluruh daftar),
// portofolio (POST, tambah saja). Akun yang belum terverifikasi tidak bisa mengubah
// skill/portofolio/sertifikat (backend: 403 ACCOUNT_PENDING_VERIFICATION).
export default function StudentProfile() {
  const { loading, error, user, profile, reload, save } = useMyProfile();
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  if (loading && !user) return <div className="sp-page"><LoadState loading /></div>;
  if (!user || !profile) return <div className="sp-page"><LoadState error={error || "Profil mahasiswa tidak ditemukan."} onRetry={reload} /></div>;

  const pending = user.status === "PENDING_VERIFICATION";

  return (
    <div className="sp-page" style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: 16 }}>
      <Header user={user} profile={profile} />
      <Completeness profile={profile} />
      <Summary profile={profile} save={save} showToast={showToast} />
      <Skills profile={profile} pending={pending} onSaved={() => { reload(); showToast("Skill disimpan."); }} />
      <Portfolio profile={profile} pending={pending} onSaved={() => { reload(); showToast("Portofolio ditambahkan."); }} />
      <Certificates pending={pending} />
      <ComingSoon title="Bagian profil lainnya">
        Video perkenalan, katalog layanan, asesmen skill, riwayat kerja/magang & pengalaman lain, bahasa,
        jam kerja, dan tampilan profil publik belum tersedia.
      </ComingSoon>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function universityOf(profile) {
  return profile.university?.name || profile.university_name_custom || null;
}

function Header({ user, profile }) {
  const status = ACCOUNT_STATUS[user.status] || { label: user.status, cls: "badge-neutral" };
  const verification = VERIFICATION_STATUS[profile.verification_status];
  const study = [universityOf(profile), profile.major, profile.semester ? `Semester ${profile.semester}` : null].filter(Boolean).join(" · ");

  return (
    <div className="card settings-card">
      <div className="row gap-16" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="avatar avatar-lg" style={{ background: "var(--primary-light)", width: 64, height: 64, fontSize: 20 }}>
          {initials(user.name || "?")}
        </div>
        {/* flex-basis: di layar sempit tombol "Ubah data akun" turun ke baris berikutnya. */}
        <div style={{ minWidth: 0, flex: "1 1 200px" }}>
          <h1 className="t-h2" style={{ overflowWrap: "anywhere" }}>{user.name}</h1>
          <div className="t-small muted mt-4">{study || "Data kampus belum lengkap"}</div>
          <div className="row gap-6 mt-8" style={{ flexWrap: "wrap" }}>
            <span className={`badge ${status.cls}`}>{status.label}</span>
            {verification && <span className={`badge ${verification.cls}`}>{verification.label}</span>}
            <span className={`badge ${profile.is_available ? "badge-info" : "badge-neutral"}`}>
              {profile.is_available ? "Tersedia untuk proyek" : "Tidak menerima proyek baru"}
            </span>
          </div>
          <div className="t-caption muted mt-8">Bergabung {formatJoined(user.joined_at)}</div>
        </div>
        <Link href="/settings?tab=kontak" className="btn btn-secondary btn-sm">Ubah data akun</Link>
      </div>
    </div>
  );
}

function Completeness({ profile }) {
  const items = [
    { done: !!profile.bio, label: "Tulis ringkasan diri", href: "#sp-summary" },
    { done: !!profile.major, label: "Isi jurusan / program studi", href: "/settings?tab=kontak" },
    { done: profile.skills.length > 0, label: "Tambahkan minimal satu skill", href: "#sp-skills" },
    { done: profile.portfolio.length > 0, label: "Tambahkan portofolio", href: "#sp-portfolio" },
    { done: profile.verification_status === "VERIFIED", label: "Verifikasi status mahasiswa", href: "/verify" },
  ];
  const done = items.filter((i) => i.done).length;
  if (done === items.length) return null;
  const pct = Math.round((done / items.length) * 100);

  return (
    <SettingsCard title="Lengkapi profil">
      <div className="row-between mt-8">
        <span className="t-small muted">Profil lengkap lebih mudah dipercaya UMKM.</span>
        <span className="t-small" style={{ fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--border)", marginTop: 8, overflow: "hidden" }} aria-hidden="true">
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)" }} />
      </div>
      <ul className="mt-12" style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 8 }}>
        {items.filter((i) => !i.done).map((i) => (
          <li key={i.label}>
            {i.href.startsWith("#")
              ? <a href={i.href} className="link-btn">{i.label}</a>
              : <Link href={i.href} className="link-btn">{i.label}</Link>}
          </li>
        ))}
      </ul>
    </SettingsCard>
  );
}

function Summary({ profile, save, showToast }) {
  const [editing, setEditing] = useState(false);

  async function submit(patch) {
    const res = await save(patch);
    if (res.ok) {
      setEditing(false);
      showToast("Ringkasan disimpan.");
    }
    return res;
  }

  return (
    <div id="sp-summary">
      <SettingsCard title="Ringkasan" onEdit={!editing ? () => setEditing(true) : undefined}>
        {editing ? (
          <EditForm
            fields={[{ key: "bio", label: "Tentang kamu", type: "textarea", maxLength: 4000, hint: "Keahlian, pengalaman, dan jenis proyek yang kamu minati." }]}
            initial={profile}
            onCancel={() => setEditing(false)}
            onSubmit={submit}
          />
        ) : profile.bio ? (
          <p className="t-body mt-8" style={{ whiteSpace: "pre-line" }}>{profile.bio}</p>
        ) : (
          <div className="empty-state mt-8">
            <p className="t-small muted">Belum ada ringkasan. Ceritakan keahlian dan pengalamanmu agar UMKM mengenalmu.</p>
            <button type="button" className="btn btn-primary btn-sm mt-8" onClick={() => setEditing(true)}>Lengkapi profil</button>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

const PENDING_NOTE = (
  <p className="t-small muted mt-8">
    Bisa diisi setelah akunmu terverifikasi. <Link href="/verify" className="link-btn">Verifikasi sekarang</Link>
  </p>
);

function Skills({ profile, pending, onSaved }) {
  const [editing, setEditing] = useState(false);

  return (
    <div id="sp-skills">
      <SettingsCard title="Skill" onEdit={!pending && !editing && profile.skills.length > 0 ? () => setEditing(true) : undefined}>
        {editing ? (
          <SkillsEditor initial={profile.skills} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onSaved(); }} />
        ) : profile.skills.length > 0 ? (
          <div className="row gap-6 mt-12" style={{ flexWrap: "wrap" }}>
            {profile.skills.map((s) => <span key={s.id} className="chip">{s.name} · {levelLabel(s.level)}</span>)}
          </div>
        ) : pending ? PENDING_NOTE : (
          <div className="empty-state mt-8">
            <p className="t-small muted">Belum ada skill. Pilih kategori keahlianmu agar muncul di pencarian UMKM.</p>
            <button type="button" className="btn btn-primary btn-sm mt-8" onClick={() => setEditing(true)}>Lengkapi profil</button>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}

function SkillsEditor({ initial, onCancel, onSaved }) {
  const [categories, setCategories] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [rows, setRows] = useState(() => (initial.length ? initial.map((s) => ({ category_id: s.id, level: s.level })) : [{ category_id: "", level: "BEGINNER" }]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const loadCategories = useCallback(async () => {
    setLoadError(null);
    const res = await profileApi.categories();
    if (res.ok) setCategories(res.data || []);
    else setLoadError(res.error.message);
  }, []);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const setRow = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (rows.some((r) => !r.category_id)) return setError("Pilih kategori untuk setiap skill.");
    if (new Set(rows.map((r) => r.category_id)).size !== rows.length) return setError("Setiap kategori hanya boleh dipilih sekali.");
    setSaving(true);
    setError(null);
    const res = await profileApi.saveSkills(rows);
    setSaving(false);
    if (res.ok) onSaved();
    else setError(Object.values(res.error.fields || {})[0] || res.error.message);
  }

  if (loadError) {
    return (
      <div className="mt-12">
        <p className="t-small" role="alert">{loadError}</p>
        <button type="button" className="btn btn-secondary btn-sm mt-8" onClick={loadCategories}>Coba lagi</button>
      </div>
    );
  }
  if (!categories) return <p className="t-small muted mt-12">Memuat kategori…</p>;

  return (
    <form className="mt-12" onSubmit={submit} noValidate>
      {rows.map((row, i) => (
        <div key={i} className="row gap-8 mb-8" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <select className="input" style={{ flex: "2 1 180px" }} aria-label={`Kategori skill ${i + 1}`} value={row.category_id} onChange={(e) => setRow(i, { category_id: e.target.value })}>
            <option value="">Pilih kategori…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" style={{ flex: "1 1 120px" }} aria-label={`Level skill ${i + 1}`} value={row.level} onChange={(e) => setRow(i, { level: e.target.value })}>
            {LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <button
            type="button" className="btn btn-ghost btn-sm" disabled={rows.length === 1}
            title={rows.length === 1 ? "Minimal satu skill" : undefined}
            onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
          >
            Hapus
          </button>
        </div>
      ))}
      <p className="t-caption muted">Minimal satu skill; daftar ini menggantikan skill yang tersimpan sebelumnya.</p>
      <button type="button" className="link-btn mt-8" onClick={() => setRows((r) => [...r, { category_id: "", level: "BEGINNER" }])}>+ Tambah skill</button>
      {error && <p className="t-small mt-8" style={{ color: "var(--error)" }} role="alert">{error}</p>}
      <div className="row gap-8 mt-12">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={saving}>Batal</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Menyimpan…" : "Simpan skill"}</button>
      </div>
    </form>
  );
}

function Portfolio({ profile, pending, onSaved }) {
  const [adding, setAdding] = useState(false);

  async function submit({ title, description, links }) {
    const media = (links || "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
    const res = await profileApi.addPortfolio({ title, description, media_urls: media });
    if (res.ok) {
      setAdding(false);
      onSaved();
      return res;
    }
    // Pesan validasi media_urls.N ditampilkan di field "Tautan".
    const fields = { ...res.error.fields };
    const mediaKey = Object.keys(fields).find((k) => k.startsWith("media_urls"));
    if (mediaKey) fields.links = fields[mediaKey];
    return { ...res, error: { ...res.error, fields } };
  }

  return (
    <div id="sp-portfolio">
      <SettingsCard title="Portofolio">
        {profile.portfolio.length > 0 && (
          <div className="mt-12" style={{ display: "grid", gap: 12 }}>
            {profile.portfolio.map((p) => (
              <div key={p.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div className="row-between gap-8">
                  <span className="settings-item-title" style={{ overflowWrap: "anywhere" }}>{p.title}</span>
                  <span className={`badge ${p.is_verified ? "badge-success" : "badge-neutral"}`}>{p.is_verified ? "Terverifikasi" : "Belum diverifikasi"}</span>
                </div>
                {p.description && <p className="t-small muted mt-4" style={{ whiteSpace: "pre-line" }}>{p.description}</p>}
                {p.media_urls.length > 0 && (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {p.media_urls.map((u) => (
                      <li key={u} className="t-small"><a href={u} target="_blank" rel="noopener noreferrer" className="link-btn" style={{ overflowWrap: "anywhere" }}>{u}</a></li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <p className="t-caption muted">Mengubah atau menghapus portofolio belum tersedia.</p>
          </div>
        )}

        {pending ? PENDING_NOTE : adding ? (
          <EditForm
            fields={[
              { key: "title", label: "Judul", required: true, maxLength: 255 },
              { key: "description", label: "Deskripsi", type: "textarea", maxLength: 4000 },
              { key: "links", label: "Tautan karya", type: "textarea", hint: "Satu tautan per baris, mis. https://behance.net/karyaku" },
            ]}
            initial={{}}
            submitLabel="Tambah portofolio"
            onCancel={() => setAdding(false)}
            onSubmit={submit}
          />
        ) : profile.portfolio.length === 0 ? (
          <div className="empty-state mt-8">
            <p className="t-small muted">Belum ada portofolio. Tunjukkan hasil karyamu agar UMKM yakin.</p>
            <button type="button" className="btn btn-primary btn-sm mt-8" onClick={() => setAdding(true)}>Lengkapi profil</button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={() => setAdding(true)}>Tambah portofolio</button>
        )}
      </SettingsCard>
    </div>
  );
}

function Certificates({ pending }) {
  const [state, setState] = useState({ loading: !pending, error: null, items: [] });

  const load = useCallback(async () => {
    if (pending) return;
    setState({ loading: true, error: null, items: [] });
    const res = await profileApi.certificates();
    setState(res.ok ? { loading: false, error: null, items: res.data || [] } : { loading: false, error: res.error.message, items: [] });
  }, [pending]);
  useEffect(() => { load(); }, [load]);

  return (
    <SettingsCard title="Sertifikat Proyek">
      {pending ? PENDING_NOTE : state.loading ? (
        <p className="t-small muted mt-8">Memuat sertifikat…</p>
      ) : state.error ? (
        <div className="mt-8">
          <p className="t-small" role="alert">{state.error}</p>
          <button type="button" className="btn btn-secondary btn-sm mt-8" onClick={load}>Coba lagi</button>
        </div>
      ) : state.items.length === 0 ? (
        <p className="t-small muted mt-8">Belum ada sertifikat. Sertifikat terbit otomatis setelah proyek selesai.</p>
      ) : (
        <div className="mt-12">
          {state.items.map((c) => (
            <InfoRow key={c.id} label={c.contract?.project?.title || c.certificate_no} note={`Kode verifikasi: ${c.verification_code}`}>
              {c.certificate_no} · {formatJoined(c.issued_at)}
            </InfoRow>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}
