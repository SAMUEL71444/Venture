"use client";

import { useTheme } from "@/context/ThemeContext";
import { IconSun, IconMoon } from "./LandingIcons";

// Tombol terang/gelap di navbar homepage. Memakai ThemeContext yang SAMA
// dengan Dashboard (ThemeMenu di popup profil), jadi pilihan tersimpan di
// localStorage "digitalin.theme" dan ikut ke Login & Dashboard; default
// "system" mengikuti preferensi perangkat.
//
// Ikon mana yang tampil diatur CSS lewat :root[data-theme] (app/landing.css),
// BUKAN dari state React — atribut itu sudah dipasang inline script di
// app/layout.js sebelum paint, jadi tidak ada kedip ikon dan HTML server ==
// render pertama klien (tanpa hydration mismatch). Label/tooltip baru
// menyesuaikan setelah ThemeProvider sinkron sesaat setelah mount.
export default function LandingThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === "dark";
  const label = isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap";

  return (
    <button
      type="button"
      className="lp-theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      data-tooltip={label}
    >
      <IconSun size={20} className="lp-theme-ic lp-theme-sun" />
      <IconMoon size={20} className="lp-theme-ic lp-theme-moon" />
    </button>
  );
}
