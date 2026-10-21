"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";
import { Reveal, Avatar, ModalActions, EMAIL_RE, digitsOf } from "./InfoParts";
import Modal from "@/components/ui/Modal";
import { maskEmail, maskName } from "@/lib/format";

const SIZES = ["1 orang (saya sendiri)", "2-9 orang", "10-49 orang", "50+ orang"];
const TIMEZONES = ["UTC+07:00 Jakarta", "UTC+08:00 Makassar", "UTC+09:00 Jayapura"];

// Tab "Info Saya" untuk Pemilik UMKM (config.settings.infoPanel = "umkm") — pola
// card My Info Upwork dengan istilah usaha: Akun, Detail Usaha, Kontak
// Usaha, dan Aksi Akun. Edit lewat Modal (components/ui/Modal.js). Semua
// perubahan cuma state lokal (prototipe, belum ada backend) — balik ke data
// semula kalau halaman di-refresh. Kartu "Preferensi AI" sengaja tidak ada:
// aplikasi ini belum punya fitur AI yang memakai data pengguna.
export default function UmkmInfoPanel({ user, showToast }) {
  const info = user.businessInfo;
  const [account, setAccount] = useState({ name: user.name, email: user.contact.email, avatar: info.avatar });
  const [biz, setBiz] = useState({ name: user.name, size: info.size });
  const [contact, setContact] = useState({
    owner: info.owner, phone: user.contact.phone, npwp: info.npwp || "",
    timezone: user.contact.timezone, address: user.contact.address,
  });
  const [reveal, setReveal] = useState({ email: false, owner: false });
  const [modal, setModal] = useState(null); // "akun" | "usaha" | "kontak" | "baru" | "tutup" | "pindah"
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [focusNpwp, setFocusNpwp] = useState(false);

  function open(name, initial = {}, opts = {}) {
    setDraft(initial);
    setErrors({});
    setFocusNpwp(!!opts.focusNpwp);
    setModal(name);
  }
  const close = () => setModal(null);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  function finish(msg) {
    close();
    showToast(msg);
  }

  function saveAccount(e) {
    e.preventDefault();
    const errs = {};
    if (!draft.name?.trim()) errs.name = "Nama akun wajib diisi.";
    if (!EMAIL_RE.test(draft.email || "")) errs.email = "Format email belum benar.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setAccount({ name: draft.name.trim(), email: draft.email.trim(), avatar: draft.avatar ?? account.avatar });
    finish("Perubahan disimpan.");
  }

  function saveBiz(e) {
    e.preventDefault();
    if (!draft.name?.trim()) return setErrors({ name: "Nama usaha wajib diisi." });
    setBiz({ name: draft.name.trim(), size: draft.size });
    finish("Perubahan disimpan.");
  }

  function saveContact(e) {
    e.preventDefault();
    const errs = {};
    if (!draft.owner?.trim()) errs.owner = "Nama pemilik wajib diisi.";
    if (digitsOf(draft.phone || "").length < 9) errs.phone = "Nomor telepon minimal 9 digit.";
    const npwpDigits = digitsOf(draft.npwp || "");
    if (npwpDigits && npwpDigits.length !== 15 && npwpDigits.length !== 16) errs.npwp = "NPWP harus 15 atau 16 digit.";
    if (!draft.address?.trim()) errs.address = "Alamat wajib diisi.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setContact({ ...draft, owner: draft.owner.trim(), npwp: npwpDigits, address: draft.address.trim() });
    finish("Perubahan disimpan.");
  }

  const fieldError = (k) => errors[k] && <div className="t-small mt-4" style={{ color: "var(--error)" }} role="alert">{errors[k]}</div>;

  return (
    <>
      <div>
        <h2 className="t-h2">Info Saya</h2>
        <p className="t-small muted mt-4">Data akun, usaha, dan kontak yang dipakai di seluruh Digital.in.</p>
      </div>

      <SettingsCard title="Akun" onEdit={() => open("akun", { name: account.name, email: account.email, avatar: account.avatar })}>
        <div className="settings-identity mt-12">
          <Avatar name={account.name} filled={!!account.avatar} />
          <div style={{ minWidth: 0 }}>
            <div className="row gap-8" style={{ flexWrap: "wrap" }}>
              <span className="settings-item-title">{account.name}</span>
              <span className="badge badge-neutral">{info.accountType}</span>
            </div>
            <div className="t-caption settings-item-sub">Pemilik akun: {info.owner}</div>
          </div>
        </div>
        <div className="settings-field mt-12">
          <span className="t-caption">EMAIL</span>
          <span className="row gap-12" style={{ flexWrap: "wrap" }}>
            <span className="t-small">{reveal.email ? account.email : maskEmail(account.email)}</span>
            <Reveal shown={reveal.email} onToggle={() => setReveal((r) => ({ ...r, email: !r.email }))} label="email" />
          </span>
        </div>
      </SettingsCard>

      <SettingsCard title="Detail Usaha" onEdit={() => open("usaha", { name: biz.name, size: biz.size })}>
        <div className="settings-identity mt-12">
          <Avatar name={biz.name} filled={!!info.logo} icon="store" />
          <div style={{ minWidth: 0 }}>
            <div className="t-caption">NAMA USAHA</div>
            <div className="settings-item-title">{biz.name}</div>
          </div>
        </div>
        <div className="settings-field mt-12">
          <span className="t-caption">UKURAN USAHA</span>
          <span className="t-small">{biz.size}</span>
        </div>
      </SettingsCard>

      <SettingsCard title="Kontak Usaha" onEdit={() => open("kontak", { ...contact })}>
        <div className="mt-12">
          <div className="settings-field">
            <span className="t-caption">PEMILIK</span>
            <span className="row gap-12" style={{ flexWrap: "wrap" }}>
              <span className="t-small">{reveal.owner ? contact.owner : maskName(contact.owner)}</span>
              <Reveal shown={reveal.owner} onToggle={() => setReveal((r) => ({ ...r, owner: !r.owner }))} label="nama pemilik" />
            </span>
          </div>
          <div className="settings-field">
            <span className="t-caption">NOMOR TELEPON</span>
            <span className="t-small">{contact.phone}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">NPWP / NIB</span>
            {contact.npwp ? (
              <span className="t-small">{"•".repeat(Math.max(contact.npwp.length - 4, 0))}{contact.npwp.slice(-4)}</span>
            ) : (
              <button type="button" className="link-btn" style={{ textAlign: "left" }} onClick={() => open("kontak", { ...contact }, { focusNpwp: true })}>
                Masukkan NPWP untuk aktifkan faktur pajak
              </button>
            )}
          </div>
          <div className="settings-field">
            <span className="t-caption">ZONA WAKTU</span>
            <span className="t-small">{contact.timezone}</span>
          </div>
          <div className="settings-field">
            <span className="t-caption">ALAMAT</span>
            <span className="t-small">{contact.address}</span>
          </div>
        </div>
      </SettingsCard>

      <div className="card settings-card">
        <p className="t-small muted">Ini adalah akun UMKM/Klien.</p>
        <div className="settings-actions mt-12">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => open("baru", { name: "" })}>Buat Akun Baru</button>
          <button type="button" className="link-danger" onClick={() => open("tutup", { agree: false })}>Tutup Akun</button>
          <button type="button" className="link-btn" onClick={() => open("pindah", { email: "" })}>Pindahkan Kepemilikan</button>
        </div>
      </div>

      {/* --- Modal edit --- */}
      <Modal open={modal === "akun"} onClose={close} title="Edit Akun">
        <form onSubmit={saveAccount} noValidate className="mt-16">
          <div className="field">
            <label htmlFor="ui-name">Nama akun</label>
            <input id="ui-name" className="input" value={draft.name || ""} onChange={set("name")} autoFocus />
            {fieldError("name")}
          </div>
          <div className="field">
            <label htmlFor="ui-email">Email</label>
            <input id="ui-email" className="input" type="email" value={draft.email || ""} onChange={set("email")} />
            {fieldError("email")}
          </div>
          <div className="field">
            <label htmlFor="ui-photo">Foto / logo akun</label>
            <input
              id="ui-photo" className="input" type="file" accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setDraft((d) => ({ ...d, avatar: f.name })); }}
            />
            {draft.avatar && <div className="t-caption mt-4">Dipilih: {draft.avatar}</div>}
          </div>
          <ModalActions onCancel={close} submitLabel="Simpan" />
        </form>
      </Modal>

      <Modal open={modal === "usaha"} onClose={close} title="Edit Detail Usaha">
        <form onSubmit={saveBiz} noValidate className="mt-16">
          <div className="field">
            <label htmlFor="ui-bizname">Nama usaha</label>
            <input id="ui-bizname" className="input" value={draft.name || ""} onChange={set("name")} autoFocus />
            {fieldError("name")}
          </div>
          <div className="field">
            <label htmlFor="ui-size">Ukuran usaha</label>
            <select id="ui-size" className="input" value={draft.size || SIZES[1]} onChange={set("size")}>
              {SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <ModalActions onCancel={close} submitLabel="Simpan" />
        </form>
      </Modal>

      <Modal open={modal === "kontak"} onClose={close} title="Edit Kontak Usaha">
        <form onSubmit={saveContact} noValidate className="mt-16">
          <div className="field">
            <label htmlFor="ui-owner">Nama pemilik</label>
            <input id="ui-owner" className="input" value={draft.owner || ""} onChange={set("owner")} />
            {fieldError("owner")}
          </div>
          <div className="field">
            <label htmlFor="ui-phone">Nomor telepon</label>
            <input id="ui-phone" className="input" inputMode="tel" value={draft.phone || ""} onChange={set("phone")} />
            {fieldError("phone")}
          </div>
          <div className="field">
            <label htmlFor="ui-npwp">NPWP / NIB (opsional)</label>
            <input
              id="ui-npwp" className="input" inputMode="numeric" placeholder="15–16 digit"
              value={draft.npwp || ""} onChange={set("npwp")} autoFocus={focusNpwp}
            />
            {fieldError("npwp")}
          </div>
          <div className="field">
            <label htmlFor="ui-tz">Zona waktu</label>
            <select id="ui-tz" className="input" value={draft.timezone || TIMEZONES[0]} onChange={set("timezone")}>
              {TIMEZONES.map((z) => <option key={z}>{z}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ui-address">Alamat</label>
            <input id="ui-address" className="input" value={draft.address || ""} onChange={set("address")} />
            {fieldError("address")}
          </div>
          <ModalActions onCancel={close} submitLabel="Simpan" />
        </form>
      </Modal>

      {/* --- Modal aksi akun --- */}
      <Modal open={modal === "baru"} onClose={close} title="Buat Akun Baru">
        <form
          className="mt-16" noValidate
          onSubmit={(e) => { e.preventDefault(); if (!draft.name?.trim()) return setErrors({ name: "Nama usaha baru wajib diisi." }); finish(`Akun "${draft.name.trim()}" dibuat (simulasi).`); }}
        >
          <p className="t-small muted mb-12">Kelola lebih dari satu usaha atau toko dengan satu login. Setiap akun punya proyek, pembayaran, dan escrow sendiri.</p>
          <div className="field">
            <label htmlFor="ui-newbiz">Nama usaha baru</label>
            <input id="ui-newbiz" className="input" value={draft.name || ""} onChange={set("name")} autoFocus />
            {fieldError("name")}
          </div>
          <ModalActions onCancel={close} submitLabel="Buat Akun" />
        </form>
      </Modal>

      <Modal open={modal === "tutup"} onClose={close} title="Tutup Akun">
        <form
          className="mt-16"
          onSubmit={(e) => { e.preventDefault(); finish("Penutupan akun belum tersedia di prototipe ini."); }}
        >
          <p className="t-small muted mb-12">
            Menutup akun akan menghapus akses ke proyek dan riwayat pembayaranmu. Selesaikan dulu proyek yang masih berjalan dan pastikan tidak ada dana escrow yang tertahan.
          </p>
          <label className="ft-check mb-16">
            <input type="checkbox" checked={!!draft.agree} onChange={(e) => setDraft((d) => ({ ...d, agree: e.target.checked }))} />
            Saya mengerti dan ingin menutup akun ini
          </label>
          <ModalActions onCancel={close} submitLabel="Tutup Akun" submitClass="btn-danger" disabled={!draft.agree} />
        </form>
      </Modal>

      <Modal open={modal === "pindah"} onClose={close} title="Pindahkan Kepemilikan">
        <form
          className="mt-16" noValidate
          onSubmit={(e) => { e.preventDefault(); if (!EMAIL_RE.test(draft.email || "")) return setErrors({ email: "Format email belum benar." }); finish(`Undangan pemindahan dikirim ke ${draft.email.trim()}.`); }}
        >
          <p className="t-small muted mb-12">Pindahkan akun ini ke pemilik usaha lain. Pemilik baru harus menerima undangan lewat email sebelum kepemilikan berpindah.</p>
          <div className="field">
            <label htmlFor="ui-newowner">Email pemilik baru</label>
            <input id="ui-newowner" className="input" type="email" value={draft.email || ""} onChange={set("email")} autoFocus />
            {fieldError("email")}
          </div>
          <ModalActions onCancel={close} submitLabel="Kirim Undangan" />
        </form>
      </Modal>
    </>
  );
}
