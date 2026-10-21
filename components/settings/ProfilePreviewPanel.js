import Link from "next/link";
import SettingsCard from "./SettingsCard";
import { initials } from "@/lib/mock-data";

// Ringkasan profil + link ke halaman Profil sungguhan (/profile) — bukan
// duplikat form edit, sesuai plan ("preview ringkas ... link Edit di
// halaman Profil").
export default function ProfilePreviewPanel({ user, config }) {
  return (
    <SettingsCard title="Profil Saya">
      <div className="row gap-16 mt-12">
        <div className="avatar avatar-lg" style={{ background: user.avatarBg || "var(--primary-light)", width: 56, height: 56, fontSize: 18 }}>
          {initials(user.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="t-h3" style={{ fontSize: 16 }}>{user.name}</div>
          <div className="t-small muted mt-4">{user.plan}</div>
        </div>
      </div>

      <div className="divider" style={{ margin: "16px 0" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {config.profileFields.map((f) => (
          <div key={f.key} className="row-between">
            <span className="t-small muted">{f.label}</span>
            <span className="t-small" style={{ fontWeight: 700 }}>
              {f.key === "role" ? config.label : user[f.key] || "-"}
            </span>
          </div>
        ))}
      </div>

      <Link href="/profile" className="link-btn mt-16" style={{ display: "inline-block" }}>Edit di halaman Profil</Link>
    </SettingsCard>
  );
}
