"use client";

import { useState } from "react";
import SettingsCard from "./SettingsCard";
import { InfoRow, EditForm, LoadState } from "./ProfileForm";
import useMyProfile from "@/components/profile/useMyProfile";
import { ACCOUNT_STATUS, ROLE_LABEL, VERIFICATION_STATUS, formatJoined } from "@/lib/profile/api";

const LOGIN_NOTE = "Dipakai untuk masuk dan belum bisa diubah dari aplikasi. Hubungi tim dukungan bila perlu menggantinya.";

// Tab "Info Kontak" / "Info Saya" untuk semua role, dari GET /me/profile (bukan data contoh).
// Yang bisa disimpan hanya field yang didukung PUT /me/profile per peran:
// - mahasiswa: nama, NIM, jurusan, semester (bio & ketersediaan di halaman Profil);
// - UMKM: info usaha (nama akun belum bisa diubah);
// - Verify & Trust (admin): tidak ada field yang bisa diubah.
export default function AccountPanel({ showToast }) {
  const { loading, error, user, profile, reload, save } = useMyProfile();
  const [editing, setEditing] = useState(null); // "akun" | "kampus" | "usaha"

  if (loading && !user) return <LoadState loading />;
  if (!user) return <LoadState error={error} onRetry={reload} />;

  const isStudent = user.role === "STUDENT";
  const isUmkm = user.role === "UMKM";
  const status = ACCOUNT_STATUS[user.status] || { label: user.status, cls: "badge-neutral" };

  async function submit(patch) {
    const res = await save(patch);
    if (res.ok) {
      setEditing(null);
      showToast("Perubahan disimpan.");
    }
    return res;
  }

  return (
    <>
      <SettingsCard
        title="Akun"
        onEdit={isStudent && editing !== "akun" ? () => setEditing("akun") : undefined}
        note={isStudent ? undefined : "Hanya dapat dilihat"}
      >
        {editing === "akun" ? (
          <EditForm
            fields={[{ key: "name", label: "Nama lengkap", required: true, maxLength: 255 }]}
            initial={{ name: user.name }}
            onCancel={() => setEditing(null)}
            onSubmit={submit}
          />
        ) : (
          <div className="mt-12">
            <InfoRow label="NAMA" note={isStudent ? undefined : "Nama akun belum bisa diubah dari aplikasi."}>{user.name}</InfoRow>
            <InfoRow label="EMAIL" note={LOGIN_NOTE}>{user.email || "-"}</InfoRow>
            <InfoRow label="NOMOR HP" note={LOGIN_NOTE}>{user.phone || "-"}</InfoRow>
            <InfoRow label="PERAN">{ROLE_LABEL[user.role] || user.role}</InfoRow>
            <InfoRow label="STATUS AKUN"><span className={`badge ${status.cls}`}>{status.label}</span></InfoRow>
            <InfoRow label="BERGABUNG">{formatJoined(user.joined_at)}</InfoRow>
          </div>
        )}
      </SettingsCard>

      {isStudent && profile && (
        <SettingsCard title="Data Kampus" onEdit={editing !== "kampus" ? () => setEditing("kampus") : undefined}>
          {editing === "kampus" ? (
            <EditForm
              fields={[
                { key: "nim", label: "NIM", maxLength: 80 },
                { key: "major", label: "Jurusan / Program Studi", maxLength: 255 },
                { key: "semester", label: "Semester", type: "number", min: 1, max: 20 },
              ]}
              initial={profile}
              onCancel={() => setEditing(null)}
              onSubmit={submit}
            />
          ) : (
            <StudentCampus profile={profile} />
          )}
        </SettingsCard>
      )}

      {isUmkm && profile && (
        <SettingsCard title="Info Usaha" onEdit={editing !== "usaha" ? () => setEditing("usaha") : undefined}>
          {editing === "usaha" ? (
            <EditForm
              fields={[
                { key: "business_name", label: "Nama usaha", required: true, maxLength: 255 },
                { key: "business_type", label: "Jenis usaha", maxLength: 255, placeholder: "Mis. Kedai kopi, Laundry" },
                { key: "city", label: "Kota", maxLength: 120 },
                { key: "address", label: "Alamat", type: "textarea", maxLength: 2000 },
                { key: "instagram_url", label: "Instagram", type: "url", maxLength: 255, placeholder: "https://instagram.com/namausaha" },
              ]}
              initial={profile}
              onCancel={() => setEditing(null)}
              onSubmit={submit}
            />
          ) : (
            <div className="mt-12">
              <InfoRow label="NAMA USAHA">{profile.business_name}</InfoRow>
              <InfoRow label="JENIS USAHA">{profile.business_type || "Belum diisi"}</InfoRow>
              <InfoRow label="KOTA">{profile.city || "Belum diisi"}</InfoRow>
              <InfoRow label="ALAMAT">{profile.address || "Belum diisi"}</InfoRow>
              <InfoRow label="INSTAGRAM">{profile.instagram_url || "Belum diisi"}</InfoRow>
            </div>
          )}
        </SettingsCard>
      )}

      {user.role === "ADMIN" && (
        <SettingsCard title="Akun Staf" note="Dikelola tim internal">
          <p className="t-small muted mt-8">Akun Verify & Trust dibuat dan dikelola tim internal. Perubahan data staf dilakukan oleh administrator sistem.</p>
        </SettingsCard>
      )}
    </>
  );
}

function StudentCampus({ profile }) {
  const university = profile.university?.name || (profile.university_name_custom ? `${profile.university_name_custom} (diisi manual)` : null);
  const verification = VERIFICATION_STATUS[profile.verification_status];
  return (
    <div className="mt-12">
      <InfoRow label="UNIVERSITAS" note="Dipilih saat mendaftar dan tidak bisa diubah dari aplikasi.">{university || "-"}</InfoRow>
      <InfoRow label="EMAIL KAMPUS" note={profile.campus_email ? "Diisi saat mendaftar dan tidak bisa diubah dari aplikasi." : undefined}>
        {profile.campus_email ? (
          <>
            {profile.campus_email}{" "}
            <span className={`badge ${profile.campus_email_verified_at ? "badge-success" : "badge-neutral"}`}>
              {profile.campus_email_verified_at ? "Terverifikasi" : "Belum diverifikasi"}
            </span>
          </>
        ) : "Tidak diisi"}
      </InfoRow>
      <InfoRow label="NIM">{profile.nim || "Belum diisi"}</InfoRow>
      <InfoRow label="JURUSAN">{profile.major || "Belum diisi"}</InfoRow>
      <InfoRow label="SEMESTER">{profile.semester || "Belum diisi"}</InfoRow>
      {verification && <InfoRow label="VERIFIKASI MAHASISWA"><span className={`badge ${verification.cls}`}>{verification.label}</span></InfoRow>}
    </div>
  );
}
