"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SettingsCard from "./SettingsCard";
import { Reveal, Avatar, ModalActions, digitsOf } from "./InfoParts";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/Icon";
import { useActivityLog } from "@/context/ActivityLogContext";
import { effectiveReports, entryHref, CATEGORY_META } from "@/lib/activity-log";
import { adminStats, recentActivity } from "@/lib/trust-stats";
import { maskEmail } from "@/lib/format";
import { formatTanggal } from "@/lib/format";

const TIMEZONES = ["UTC+07:00 Jakarta", "UTC+08:00 Makassar", "UTC+09:00 Jayapura"];

// Tab "Info Saya" untuk staf Verify & Trust (config.settings.infoPanel =
// "trust") — card, tipografi, dan pola pensil yang SAMA dengan UmkmInfoPanel,
// tapi isinya peran internal. Statistik & Aktivitas Terbaru DIHITUNG dari log
// aktivitas terpusat (lib/activity-log.js) dan laporan efektif — tidak ada
// angka tetap di file ini. State edit lokal (prototipe, belum ada backend).
export default function TrustInfoPanel({ user, showToast }) {
  const { entries } = useActivityLog();
  const staff = user.staffInfo;

  const [account, setAccount] = useState({ name: user.name, avatar: null });
  const [contact, setContact] = useState({ phone: user.contact.phone, timezone: user.contact.timezone, shift: staff.shift });
  const [showEmail, setShowEmail] = useState(false);
  const [modal, setModal] = useState(null); // "akun" | "kontak" | "tutup"
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});

  const reports = useMemo(() => effectiveReports(entries), [entries]);
  const stats = useMemo(() => adminStats(user.adminId, { entries, reports }), [user.adminId, entries, reports]);
  const recent = useMemo(() => recentActivity(entries, user.adminId, 5), [entries, user.adminId]);

  function open(name, initial = {}) {
    setDraft(initial);
    setErrors({});
    setModal(name);
  }
  const close = () => setModal(null);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const fieldError = (k) => errors[k] && <div className="pp-error" role="alert">{errors[k]}</div>;

  function saveAccount(e) {
    e.preventDefault();
    if (!draft.name?.trim()) return setErrors({ name: "Nama wajib diisi." });
    setAccount({ name: draft.name.trim(), avatar: draft.avatar ?? account.avatar });
    close();
    showToast("Perubahan disimpan.");
  }

  function saveContact(e) {
    e.preventDefault();
    const errs = {};
    if (digitsOf(draft.phone || "").length < 9) errs.phone = "Nomor telepon minimal 9 digit.";
    if (!draft.shift?.trim()) errs.shift = "Jadwal shift wajib diisi.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setContact({ phone: draft.phone.trim(), timezone: draft.timezone, shift: draft.shift.trim() });
    close();
    showToast("Perubahan disimpan.");
  }

  function submitClose(e) {
    e.preventDefault();
    if (!draft.reason?.trim()) return setErrors({ reason: "Alasan penutupan wajib diisi." });
    close();
    showToast(`Permintaan penutupan akun dikirim ke ${staff.supervisor.split(" (")[0]} untuk disetujui.`);
  }

  const avg = stats.avgResponseDays;
  const statCards = [
    { label: "VERIFIKASI DIPROSES", value: stats.verifikasiDiproses, sub: "keputusan setujui/tolak" },
    { label: "TRANSAKSI DIAWASI", value: stats.transaksiDiawasi, sub: "dana yang pernah kamu tindak" },
    { label: "LAPORAN DITANGANI", value: stats.laporanDitangani, sub: "berstatus selesai" },
    { label: "RATA-RATA RESPONS", value: avg == null ? "–" : `${avg.toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`, sub: `dari ${stats.responseSamples} penanganan` },
  ];

  return (
    <>
      <div>
        <h2 className="t-h2">Info Saya</h2>
        <p className="t-small muted mt-4">Data akun, penugasan, dan kinerjamu sebagai staf Verify &amp; Trust.</p>
      </div>

      <SettingsCard title="Akun" onEdit={() => open("akun", { name: account.name, avatar: account.avatar })}>
        <div className="settings-identity mt-12">
          <Avatar name={account.name} filled bg={user.avatarBg} />
          <div style={{ minWidth: 0 }}>
            <div className="row gap-8" style={{ flexWrap: "wrap" }}>
              <span className="settings-item-title">{account.name}</span>
              <span className="badge badge-primary"><Icon name="shield" /> Verify &amp; Trust</span>
            </div>
            <div className="t-caption settings-item-sub">{user.plan}</div>
          </div>
        </div>
        <div className="settings-field mt-12">
          <span className="t-caption">EMAIL KERJA</span>
          <span className="row gap-12" style={{ flexWrap: "wrap" }}>
            <span className="t-small">{showEmail ? user.contact.email : maskEmail(user.contact.email)}</span>
            <Reveal shown={showEmail} onToggle={() => setShowEmail((v) => !v)} label="email kerja" />
          </span>
        </div>
      </SettingsCard>

      <SettingsCard title="Detail Penugasan" note="Dikelola oleh tim internal">
        <div className="mt-12">
          <div className="settings-field">
            <span className="t-caption">ID ADMIN</span>
            <span className="settings-item-title">{user.adminId}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">LEVEL AKSES</span>
            <span className="t-small">{user.accessLevel}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">DEPARTEMEN / DIVISI</span>
            <span className="t-small">{staff.department}</span>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Statistik Kinerja">
        <div className="ts-grid mt-12">
          {statCards.map((s) => (
            <div key={s.label} className="ts-stat">
              <div className="t-caption">{s.label}</div>
              <div className="ud-stat-value">{s.value}</div>
              <div className="ud-stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Aktivitas Terbaru">
        {recent.length === 0 ? (
          <p className="t-small muted mt-12">Belum ada aktivitas tercatat. Tindakan di Verifikasi, Transaksi & Dana, dan Laporan akan muncul di sini.</p>
        ) : (
          <ol className="act-list mt-8">
            {recent.map((e) => {
              const meta = CATEGORY_META[e.category];
              const href = entryHref(e);
              const body = (
                <>
                  <span className={`act-icon ${e.category}`}><Icon name={meta.icon} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="act-summary">{e.summary}</span>
                    <span className="t-caption act-meta">
                      {meta.label} · {formatTanggal(e.at.slice(0, 10))}{e.seed ? "" : ` · ${e.at.slice(11)}`}
                    </span>
                  </span>
                  {href && <Icon name="chevRight" />}
                </>
              );
              return (
                <li key={e.id}>
                  {href ? <Link href={href} className="act-item">{body}</Link> : <div className="act-item">{body}</div>}
                </li>
              );
            })}
          </ol>
        )}
      </SettingsCard>

      <SettingsCard title="Kontak & Akses" onEdit={() => open("kontak", { ...contact })}>
        <div className="mt-12">
          <div className="settings-field">
            <span className="t-caption">NOMOR TELEPON</span>
            <span className="t-small">{contact.phone}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">ZONA WAKTU</span>
            <span className="t-small">{contact.timezone}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">JADWAL SHIFT</span>
            <span className="t-small">{contact.shift}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">SUPERVISOR</span>
            <span className="t-small">{staff.supervisor}</span>
          </div>
        </div>
      </SettingsCard>

      <div className="card settings-card">
        <p className="t-small muted">Ini adalah akun staff internal (Verify &amp; Trust).</p>
        <div className="settings-actions mt-12">
          <button type="button" className="link-danger" onClick={() => open("tutup", { reason: "" })}>Tutup Akun</button>
          <span className="t-caption">Membutuhkan persetujuan supervisor</span>
        </div>
      </div>

      {/* --- Modal --- */}
      <Modal open={modal === "akun"} onClose={close} title="Edit Akun">
        <form onSubmit={saveAccount} noValidate className="mt-16">
          <div className="field">
            <label htmlFor="ti-name">Nama lengkap</label>
            <input id="ti-name" className="input" value={draft.name || ""} onChange={set("name")} autoFocus />
            {fieldError("name")}
          </div>
          <div className="field">
            <label htmlFor="ti-photo">Foto profil</label>
            <input
              id="ti-photo" className="input" type="file" accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setDraft((d) => ({ ...d, avatar: f.name })); }}
            />
            {draft.avatar && <div className="t-caption mt-4">Dipilih: {draft.avatar}</div>}
          </div>
          <ModalActions onCancel={close} submitLabel="Simpan" />
        </form>
      </Modal>

      <Modal open={modal === "kontak"} onClose={close} title="Edit Kontak & Akses">
        <form onSubmit={saveContact} noValidate className="mt-16">
          <div className="field">
            <label htmlFor="ti-phone">Nomor telepon</label>
            <input id="ti-phone" className="input" inputMode="tel" value={draft.phone || ""} onChange={set("phone")} autoFocus />
            {fieldError("phone")}
          </div>
          <div className="field">
            <label htmlFor="ti-tz">Zona waktu</label>
            <select id="ti-tz" className="input" value={draft.timezone || TIMEZONES[0]} onChange={set("timezone")}>
              {TIMEZONES.map((z) => <option key={z}>{z}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ti-shift">Jadwal shift</label>
            <input id="ti-shift" className="input" value={draft.shift || ""} onChange={set("shift")} />
            {fieldError("shift")}
          </div>
          <p className="t-caption" style={{ marginBottom: 14 }}>Supervisor ditentukan oleh tim internal dan tidak bisa diubah di sini.</p>
          <ModalActions onCancel={close} submitLabel="Simpan" />
        </form>
      </Modal>

      <Modal open={modal === "tutup"} onClose={close} title="Ajukan Penutupan Akun">
        <form onSubmit={submitClose} noValidate className="mt-16">
          <p className="t-small muted mb-12">
            Penutupan akun staf membutuhkan persetujuan supervisor ({staff.supervisor}). Permintaanmu akan dikirim dan akunmu tetap aktif sampai disetujui.
          </p>
          <div className="field">
            <label htmlFor="ti-reason">Alasan penutupan</label>
            <textarea id="ti-reason" className="input" rows={3} value={draft.reason || ""} onChange={set("reason")} autoFocus />
            {fieldError("reason")}
          </div>
          <ModalActions onCancel={close} submitLabel="Ajukan Penutupan" submitClass="btn-danger" />
        </form>
      </Modal>
    </>
  );
}
