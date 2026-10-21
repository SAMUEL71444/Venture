"use client";

import { useId, useState } from "react";
import Icon from "@/components/Icon";
import { useTheme } from "@/context/ThemeContext";

const OPTIONS = [
  { value: "system", icon: "monitor", label: "Otomatis", desc: "Ikuti tema perangkatmu" },
  { value: "light", icon: "sun", label: "Terang", desc: "Latar terang dengan teks gelap" },
  { value: "dark", icon: "moon", label: "Gelap", desc: "Latar gelap dengan teks terang" },
];

// Baris "Tema" di popup profil (UserMenu) — expand/collapse di tempat
// (gaya referensi Upwork), bukan dropdown terpisah. Dipakai lewat UserMenu,
// jadi otomatis muncul di ketiga role lewat AppShell.
export default function ThemeMenu() {
  const { theme, resolved, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const current = OPTIONS.find((o) => o.value === theme) || OPTIONS[0];

  return (
    <div className="theme-menu">
      <button
        type="button"
        className="user-menu-item"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="row gap-10"><Icon name={resolved === "dark" ? "moon" : "sun"} /> Tema: {current.label}</span>
        <span className={`cc-chev ${open ? "open" : ""}`} style={{ marginLeft: "auto" }}><Icon name="chevDown" /></span>
      </button>
      <div id={bodyId} className={`cc-body ${open ? "open" : ""}`}>
        <div className="cc-body-inner theme-menu-options">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`theme-menu-option ${theme === o.value ? "active" : ""}`}
              onClick={() => setTheme(o.value)}
            >
              <Icon name={o.icon} />
              <span className="theme-menu-option-text">
                <span className="theme-menu-option-label">{o.label}</span>
                <span className="theme-menu-option-desc">{o.desc}</span>
              </span>
              {theme === o.value && <Icon name="check" className="theme-menu-option-check" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
