"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";
import { ComingSoon, LoadState } from "./ProfileForm";
import useMyProfile from "@/components/profile/useMyProfile";

// Tab "Pengaturan Profil". Ketersediaan mahasiswa tersimpan lewat PUT /me/profile
// (is_available); visibilitas & bahasa profil belum punya endpoint → "Segera hadir".
export default function ProfileSettingsPanel({ config, showToast }) {
  return (
    <>
      {config.key === "mahasiswa" && <AvailabilityCard showToast={showToast} />}
      <ComingSoon title="Visibilitas & Bahasa Profil">
        Pengaturan siapa yang bisa melihat profilmu dan bahasa profil belum tersedia.
      </ComingSoon>
    </>
  );
}

function AvailabilityCard({ showToast }) {
  const { loading, error, profile, reload, save } = useMyProfile();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(null);

  if (loading && !profile) return <LoadState loading />;
  if (!profile) return <LoadState error={error} onRetry={reload} />;

  async function toggle() {
    if (saving) return;
    setSaving(true);
    setFailure(null);
    const res = await save({ is_available: !profile.is_available });
    setSaving(false);
    if (res.ok) showToast(res.data.profile.is_available ? "Kamu ditandai tersedia untuk proyek baru." : "Kamu ditandai tidak menerima proyek baru.");
    else setFailure(res.error.message);
  }

  return (
    <SettingsCard title="Ketersediaan">
      <div className="row-between mt-12 gap-16">
        <div>
          <div className="settings-item-title">Tersedia untuk proyek baru</div>
          <div className="t-caption settings-item-sub">Saat dimatikan, UMKM tahu kamu sedang tidak menerima proyek baru.</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!profile.is_available}
          aria-label="Tersedia untuk proyek baru"
          className={`toggle-switch ${profile.is_available ? "on" : ""}`}
          onClick={toggle}
          disabled={saving}
        >
          <span className="toggle-knob" />
        </button>
      </div>
      {failure && <p className="t-small mt-8" style={{ color: "var(--error)" }} role="alert">{failure}</p>}
    </SettingsCard>
  );
}
