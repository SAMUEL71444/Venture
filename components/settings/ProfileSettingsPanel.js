"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";

const VISIBILITY = [
  { id: "publik", label: "Publik", desc: "Profilmu bisa ditemukan di hasil pencarian dan dilihat siapa saja." },
  { id: "privat", label: "Privat", desc: "Cuma kamu dan pihak yang sedang bertransaksi denganmu yang bisa melihat profil." },
];

// Visibilitas profil (radio card, gaya .radio-card yang sudah ada di
// app/choose-type) + bahasa profil. Nggak ada di role Verify & Trust
// (profil internal nggak publik) — lihat config.settingsNav.
export default function ProfileSettingsPanel({ showToast }) {
  const [visibility, setVisibility] = useState("publik");
  const [language, setLanguage] = useState("id");

  return (
    <SettingsCard title="Pengaturan Profil">
      <div className="t-caption mt-12 mb-8">VISIBILITAS PROFIL</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {VISIBILITY.map((v) => (
          <label key={v.id} className={`radio-card ${visibility === v.id ? "selected" : ""}`}>
            <input
              type="radio" name="visibility" value={v.id} checked={visibility === v.id}
              onChange={() => { setVisibility(v.id); showToast("Perubahan disimpan."); }}
              style={{ marginTop: 3 }}
            />
            <div>
              <div className="settings-item-title">{v.label}</div>
              <div className="t-caption settings-item-sub">{v.desc}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="field mt-16" style={{ marginBottom: 0 }}>
        <label>Bahasa Profil</label>
        <select className="input" value={language} onChange={(e) => { setLanguage(e.target.value); showToast("Perubahan disimpan."); }}>
          <option value="id">Bahasa Indonesia</option>
          <option value="en">English</option>
        </select>
      </div>
    </SettingsCard>
  );
}
