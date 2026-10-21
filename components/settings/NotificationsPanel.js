"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";

const CHANNELS = ["Email", "Push"];

// Tab "notifikasi": satu card per kanal, tiap card berisi toggle untuk semua
// item config.notificationPrefs (daftarnya beda per role).
export default function NotificationsPanel({ config, showToast }) {
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(CHANNELS.flatMap((c) => config.notificationPrefs.map((p) => [`${c}:${p}`, true])))
  );

  function toggle(key) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    showToast("Perubahan disimpan.");
  }

  return (
    <>
      {CHANNELS.map((channel) => (
        <SettingsCard key={channel} title={`Notifikasi ${channel}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }} className="mt-12">
            {config.notificationPrefs.map((label) => {
              const key = `${channel}:${label}`;
              return (
                <div key={key} className="user-menu-row" style={{ padding: "10px 0" }}>
                  <span className="settings-item-title">{label}</span>
                  <button
                    type="button"
                    className={`toggle-switch ${prefs[key] ? "on" : ""}`}
                    onClick={() => toggle(key)}
                    aria-label={`Toggle notifikasi ${channel} ${label}`}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
              );
            })}
          </div>
        </SettingsCard>
      ))}
    </>
  );
}
