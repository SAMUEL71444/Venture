"use client";

import Icon from "@/components/Icon";
import ThemeMenu from "@/components/ui/ThemeMenu";
import { initials } from "@/lib/mock-data";

// Item menu (profileMenu) dan toggle "Online untuk pesan" (showOnlineToggle)
// sekarang datang dari config/roles.js lewat UserMenuTrigger, bukan
// hardcoded di sini — supaya komponen ini tetap SATU untuk ketiga role.
// group "top" tampil sebelum baris Tema, "bottom" sesudahnya, persis
// urutan visual yang sudah ada (Profil Saya lalu Tema/Pengaturan/Bantuan)
// — cuma sekarang datanya bisa beda per role.
export default function UserMenu({ user, profileMenu = [], showOnlineToggle = true, onlineForMessages, onToggleOnline, onLogout }) {
  const topItems = profileMenu.filter((i) => i.group !== "bottom");
  const bottomItems = profileMenu.filter((i) => i.group === "bottom");

  return (
    <div className="user-menu card" role="menu" onClick={(e) => e.stopPropagation()}>
      <div className="user-menu-header">
        <div className="avatar avatar-lg" style={{ background: user.avatarBg || "var(--primary-light)" }}>
          {initials(user.name)}
        </div>
        <div>
          <div className="t-h3" style={{ fontSize: 15 }}>{user.name}</div>
          <div className="t-small muted">{user.plan || "Freelancer Basic"}</div>
        </div>
      </div>

      {showOnlineToggle && (
        <div className="user-menu-row">
          <span className="t-small" style={{ fontWeight: 600 }}>Online untuk pesan</span>
          <button
            className={`toggle-switch ${onlineForMessages ? "on" : ""}`}
            onClick={onToggleOnline}
            aria-label="Toggle online untuk pesan"
          >
            <span className="toggle-knob" />
          </button>
        </div>
      )}

      <div className="divider" style={{ margin: "8px 0" }} />

      {topItems.map((item) => (
        <a key={item.href} href={item.href} className="user-menu-item" role="menuitem">
          <Icon name={item.icon} /> {item.label}
        </a>
      ))}

      <div className="divider" style={{ margin: "8px 0" }} />

      <ThemeMenu />
      {bottomItems.map((item) => (
        <a key={item.href} href={item.href} className="user-menu-item" role="menuitem">
          <Icon name={item.icon} /> {item.label}
        </a>
      ))}

      <div className="divider" style={{ margin: "8px 0" }} />

      <button className="user-menu-item danger" onClick={onLogout} role="menuitem">
        <Icon name="logout" /> Keluar
      </button>
    </div>
  );
}
