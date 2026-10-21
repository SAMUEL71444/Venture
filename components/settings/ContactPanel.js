"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";
import { maskEmail } from "@/lib/format";

// Tab default ("kontak") untuk Freelancer & Verify & Trust — 2 card: Akun
// (User ID + Nama + Email tersensor + "Tutup akun saya") dan Lokasi. UMKM
// memakai UmkmInfoPanel (config.settings.myInfoPanel). Field yang "disimpan" cuma state lokal
// (prototipe, belum ada backend) — nilainya balik ke semula kalau halaman
// di-refresh.
export default function ContactPanel({ user, showToast }) {
  const [account, setAccount] = useState({ name: user.name, email: user.contact.email });
  const [location, setLocation] = useState({
    timezone: user.contact.timezone, address: user.contact.address, phone: user.contact.phone,
  });
  const [editingAccount, setEditingAccount] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [draft, setDraft] = useState(account);
  const [locDraft, setLocDraft] = useState(location);

  function startEditAccount() { setDraft(account); setEditingAccount(true); }
  function saveAccount() { setAccount(draft); setEditingAccount(false); showToast("Perubahan disimpan."); }
  function startEditLocation() { setLocDraft(location); setEditingLocation(true); }
  function saveLocation() { setLocation(locDraft); setEditingLocation(false); showToast("Perubahan disimpan."); }

  return (
    <>
      <SettingsCard title="Akun" onEdit={!editingAccount ? startEditAccount : undefined}>
        {editingAccount ? (
          <div className="mt-12">
            <div className="field">
              <label>Nama</label>
              <input className="input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Email</label>
              <input className="input" type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
            </div>
            <div className="row gap-8">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingAccount(false)}>Batal</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={saveAccount}>Simpan</button>
            </div>
          </div>
        ) : (
          <div className="mt-12">
            <div className="settings-field">
              <span className="t-caption">USER ID</span>
              <span className="t-small settings-field-readonly">{user.contact.userId}</span>
            </div>
            <div className="settings-field">
              <span className="t-caption">NAMA</span>
              <span className="settings-item-title">{account.name}</span>
            </div>
            <div className="settings-field">
              <span className="t-caption">EMAIL</span>
              <span className="t-small">{maskEmail(account.email)}</span>
            </div>
            <button type="button" className="link-danger mt-12" onClick={() => showToast("Penutupan akun belum tersedia di prototipe ini.")}>Tutup akun saya</button>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title="Lokasi" onEdit={!editingLocation ? startEditLocation : undefined}>
        {editingLocation ? (
          <div className="mt-12">
            <div className="field">
              <label>Zona Waktu</label>
              <input className="input" value={locDraft.timezone} onChange={(e) => setLocDraft((d) => ({ ...d, timezone: e.target.value }))} />
            </div>
            <div className="field">
              <label>Alamat</label>
              <input className="input" value={locDraft.address} onChange={(e) => setLocDraft((d) => ({ ...d, address: e.target.value }))} />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Nomor Telepon</label>
              <input className="input" value={locDraft.phone} onChange={(e) => setLocDraft((d) => ({ ...d, phone: e.target.value }))} />
            </div>
            <div className="row gap-8">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingLocation(false)}>Batal</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={saveLocation}>Simpan</button>
            </div>
          </div>
        ) : (
          <div className="mt-12">
            <div className="settings-field">
              <span className="t-caption">ZONA WAKTU</span>
              <span className="t-small">{location.timezone}</span>
            </div>
            <div className="settings-field">
              <span className="t-caption">ALAMAT</span>
              <span className="t-small">{location.address}</span>
            </div>
            <div className="settings-field">
              <span className="t-caption">TELEPON</span>
              <span className="t-small">{location.phone}</span>
            </div>
          </div>
        )}
      </SettingsCard>
    </>
  );
}
