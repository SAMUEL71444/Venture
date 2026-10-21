"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";

const DEVICES = [
  { id: "d1", name: "Chrome di Windows", where: "Jakarta, Indonesia", now: true },
  { id: "d2", name: "Safari di iPhone", where: "Depok, Indonesia", now: false },
  { id: "d3", name: "Firefox di macOS", where: "Bandung, Indonesia", now: false },
];

// Tab "keamanan": ganti kata sandi (validasi lokal), verifikasi dua langkah
// (toggle), perangkat aktif. Semua state lokal — prototipe tanpa backend.
export default function SecurityPanel({ showToast }) {
  const [form, setForm] = useState({ old: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [twoStep, setTwoStep] = useState(false);
  const [devices, setDevices] = useState(DEVICES);

  function submit(e) {
    e.preventDefault();
    if (!form.old) return setError("Masukkan kata sandi lama.");
    if (form.next.length < 8) return setError("Kata sandi baru minimal 8 karakter.");
    if (form.next !== form.confirm) return setError("Konfirmasi kata sandi tidak cocok.");
    setError("");
    setForm({ old: "", next: "", confirm: "" });
    showToast("Kata sandi diperbarui.");
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <SettingsCard title="Kata Sandi">
        <form onSubmit={submit} className="mt-12">
          <div className="field"><label>Kata sandi lama</label><input className="input" type="password" value={form.old} onChange={set("old")} /></div>
          <div className="field"><label>Kata sandi baru</label><input className="input" type="password" value={form.next} onChange={set("next")} /></div>
          <div className="field"><label>Konfirmasi kata sandi baru</label><input className="input" type="password" value={form.confirm} onChange={set("confirm")} /></div>
          {error && <div className="t-small mb-8" style={{ color: "var(--error)" }} role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary btn-sm">Perbarui Kata Sandi</button>
        </form>
      </SettingsCard>

      <SettingsCard title="Verifikasi Dua Langkah">
        <div className="row-between mt-12">
          <span className="t-small muted" style={{ maxWidth: 400 }}>Minta kode tambahan saat masuk dari perangkat baru.</span>
          <button
            type="button"
            className={`toggle-switch ${twoStep ? "on" : ""}`}
            onClick={() => { setTwoStep((v) => !v); showToast(twoStep ? "Verifikasi dua langkah dimatikan." : "Verifikasi dua langkah diaktifkan."); }}
            aria-label="Toggle verifikasi dua langkah"
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </SettingsCard>

      <SettingsCard title="Perangkat Aktif">
        <div className="mt-12">
          {devices.map((d) => (
            <div key={d.id} className="settings-field">
              <div>
                <div className="settings-item-title">{d.name}</div>
                <div className="t-caption settings-item-sub">{d.where}{d.now ? " · Perangkat ini" : ""}</div>
              </div>
              {!d.now && (
                <button
                  type="button" className="btn btn-ghost btn-sm"
                  onClick={() => { setDevices((l) => l.filter((x) => x.id !== d.id)); showToast("Perangkat dikeluarkan."); }}
                >
                  Keluar
                </button>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>
    </>
  );
}
