"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import CollapsibleCard from "@/components/ui/CollapsibleCard";
import { useRole } from "@/context/RoleContext";
import { initials, PROJECTS } from "@/lib/mock-data";
import { FREELANCER_PROFILE, USE_COMPLETE_PROFILE } from "@/lib/profile.mock";
import { PLATFORM_USERS } from "@/lib/users.mock";
import { getProfileCompleteness, getGrowthTip } from "@/lib/profile";

// Kategori keahlian yang bisa dipilih di widget Preferensi — dari kategori
// proyek yang sudah ada (lib/mock-data.js), bukan daftar baru yang terpisah.
const ALL_CATEGORIES = [...new Set(PROJECTS.map((p) => p.category))];
const JOB_PREFS = ["Jangka pendek", "Jangka panjang", "Keduanya"];

// Panel kanan dashboard freelancer, gaya sidebar Upwork. Data profil dari
// FREELANCER_PROFILE (lib/profile.mock.js) — SUMBER YANG SAMA dengan halaman
// /profile (components/profile/FreelancerProfile.js), lewat lib/profile.js
// (getProfileCompleteness/getGrowthTip), supaya persentase & status "belum
// lengkap" selalu sinkron. State edit di sini lokal ke komponen ini
// (prototipe, belum ada backend) — nggak menyatu dengan perubahan yang
// dibuat di /profile pada sesi yang sama.
export default function ProfileSidePanel() {
  const { user } = useRole();
  const [data, setData] = useState(FREELANCER_PROFILE);
  const [toast, setToast] = useState(null);
  const [prefOpen, setPrefOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  const idVerified = USE_COMPLETE_PROFILE || PLATFORM_USERS.find((u) => u.id === "u-s1")?.verification === "terverifikasi";
  const { pct, firstMissing } = getProfileCompleteness(data, idVerified);
  const tip = pct === 100 ? getGrowthTip(data) : null;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }
  function update(patch, msg) {
    setData((d) => ({ ...d, ...patch }));
    if (msg) showToast(msg);
  }

  function toggleCategory(cat) {
    const has = data.categories.includes(cat);
    update({ categories: has ? data.categories.filter((c) => c !== cat) : [...data.categories, cat] });
  }

  return (
    // Lebar 300px di desktop, penuh saat turun ke bawah konten (< lg) —
    // lihat .fp-side-panel di globals.css bagian 41.
    <aside className="fp-side-panel">
      <div className="card card-pad">
        <div className="row gap-12">
          <div className="avatar avatar-lg" style={{ background: user.avatarBg || "var(--primary-light)" }}>
            {initials(user.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="t-h3">{user.name}</div>
            <div className="t-small muted">{user.plan}</div>
          </div>
        </div>

        <div className="row-between mt-16">
          <div>
            <div className="t-caption">VISIBILITAS PROFIL</div>
            <div className="t-small" style={{ fontWeight: 700 }}>Publik</div>
          </div>
          <Link href="/settings?tab=pengaturan-profil" className="fp-icon-btn" aria-label="Edit visibilitas profil" title="Edit visibilitas profil">
            <Icon name="pencil" />
          </Link>
        </div>

        {pct < 100 ? (
          <Link href={`/profile?focus=${firstMissing}`} className="mt-12 fp-complete-link" style={{ display: "block" }}>
            <div className="row-between t-caption mb-4"><span>Lengkapi profil</span><span>{pct}%</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          </Link>
        ) : (
          <div className="mt-12">
            <span className="badge badge-success"><Icon name="check" /> Profil Lengkap</span>
            {tip && (
              <p className="t-small muted mt-8">
                {tip.message} <Link href={tip.href} className="link-btn">Lihat</Link>
              </p>
            )}
          </div>
        )}
      </div>

      {!idVerified && (
        <div className="card card-pad">
          <div className="t-h3" style={{ fontSize: 15 }}>Verifikasi Identitas</div>
          <p className="t-small muted mt-8">
            Tingkatkan visibilitas profil di hasil pencarian dengan badge verifikasi.
          </p>
          <Link href="/settings?tab=verifikasi" className="link-btn mt-8">Ajukan Verifikasi</Link>
        </div>
      )}

      <CollapsibleCard title="Jangkau Lebih Banyak Klien">
        <div className="fp-side-item" style={{ paddingTop: 0 }}>
          <div className="row-between">
            <span className="t-small row gap-6" style={{ fontWeight: 600 }}>
              Badge Ketersediaan
              <span title="Menampilkan lencana 'Tersedia' di hasil pencarian UMKM."><Icon name="info" /></span>
            </span>
            <button
              type="button"
              className={`toggle-switch ${data.availabilityBadge ? "on" : ""}`}
              onClick={() => update({ availabilityBadge: !data.availabilityBadge }, data.availabilityBadge ? "Badge Ketersediaan dimatikan." : "Badge Ketersediaan diaktifkan.")}
              aria-label="Toggle Badge Ketersediaan"
            >
              <span className="toggle-knob" />
            </button>
          </div>
          <div className="t-caption mt-4">{data.availabilityBadge ? "Aktif" : "Off"}</div>
        </div>
        <div className="fp-side-item">
          <div className="row-between">
            <span className="t-small row gap-6" style={{ fontWeight: 600 }}>
              Boost Profil
              <span title="Naikkan posisi profilmu di hasil pencarian UMKM."><Icon name="info" /></span>
            </span>
            <button
              type="button"
              className={`toggle-switch ${data.boostProfile ? "on" : ""}`}
              onClick={() => update({ boostProfile: !data.boostProfile }, data.boostProfile ? "Boost Profil dimatikan." : "Boost Profil diaktifkan.")}
              aria-label="Toggle Boost Profil"
            >
              <span className="toggle-knob" />
            </button>
          </div>
          <div className="t-caption mt-4">{data.boostProfile ? "Aktif" : "Off"}</div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Preferensi" defaultOpen>
        <div className="fp-side-item" style={{ paddingTop: 0 }}>
          <div className="row-between">
            <div>
              <div className="t-caption">JAM KERJA PER MINGGU</div>
              <div className="t-small" style={{ fontWeight: 700 }}>{data.hoursPerWeek}</div>
            </div>
            <Link href="/profile?focus=hours" className="fp-icon-btn" aria-label="Edit jam kerja per minggu" title="Edit jam kerja per minggu">
              <Icon name="pencil" />
            </Link>
          </div>
        </div>

        <div className="fp-side-item">
          <div className="row-between">
            <div>
              <div className="t-caption">PREFERENSI PEKERJAAN</div>
              <div className="t-small" style={{ fontWeight: 700 }}>{data.jobPreference || "Belum ada preferensi"}</div>
            </div>
            <button type="button" className="fp-icon-btn" onClick={() => setPrefOpen((v) => !v)} aria-label="Edit preferensi pekerjaan" title="Edit preferensi pekerjaan">
              <Icon name="pencil" />
            </button>
          </div>
          {prefOpen && (
            <div className="fp-fresh mt-8">
              <select
                className="input"
                value={data.jobPreference || ""}
                onChange={(e) => { update({ jobPreference: e.target.value || null }, "Preferensi disimpan."); setPrefOpen(false); }}
              >
                <option value="">Belum ada preferensi</option>
                {JOB_PREFS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="fp-side-item">
          <div className="row-between" style={{ alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div className="t-caption">KATEGORI KEAHLIAN</div>
              <div className="row mt-4" style={{ flexWrap: "wrap", gap: 6 }}>
                {data.categories.map((c) => <span key={c} className="chip">{c}</span>)}
              </div>
            </div>
            <button type="button" className="fp-icon-btn" onClick={() => setCatOpen((v) => !v)} aria-label="Edit kategori keahlian" title="Edit kategori keahlian">
              <Icon name="pencil" />
            </button>
          </div>
          {catOpen && (
            <div className="fp-fresh mt-8 row" style={{ flexWrap: "wrap", gap: 6 }}>
              {ALL_CATEGORIES.map((c) => (
                <button
                  key={c} type="button"
                  className={`chip-filter ${data.categories.includes(c) ? "active" : ""}`}
                  onClick={() => toggleCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Proposal">
        <p className="t-small muted" style={{ paddingTop: 0 }}>Sedang mencari kerja? Jelajahi proyek dan mulai kirim lamaran.</p>
        <Link href="/projects?tab=semua" className="link-btn mt-8" style={{ display: "inline-block" }}>Lamaran Saya</Link>
      </CollapsibleCard>

      <CollapsibleCard title="Katalog Proyek">
        <p className="t-small muted" style={{ paddingTop: 0 }}>Katalog adalah paket jasa siap beli — UMKM bisa langsung memesan tanpa negosiasi.</p>
        <div className="row gap-16 mt-8" style={{ flexWrap: "wrap" }}>
          <Link href="/projects" className="link-btn">Dashboard Proyek Saya</Link>
          <Link href="/profile?focus=catalog" className="link-btn">Buat Proyek Katalog</Link>
        </div>
      </CollapsibleCard>

      <div className="fp-side-footer-links">
        <Link href="/projects?tab=aktif" className="fp-side-footer-link">
          Kontrak Langsung <Icon name="externalLink" />
        </Link>
        <Link href="/settings?tab=pembayaran" className="fp-side-footer-link">
          Penarikan Dana <Icon name="externalLink" />
        </Link>
        <Link href="/help" className="fp-side-footer-link">
          Pusat Bantuan <Icon name="externalLink" />
        </Link>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </aside>
  );
}
