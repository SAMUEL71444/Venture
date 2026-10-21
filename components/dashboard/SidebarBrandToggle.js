"use client";

import Icon from "@/components/Icon";
import { LogoMark, Wordmark } from "@/components/brand/Logo";

// Header sidebar, gaya Upwork:
// - TERBUKA: logo statis (tidak bereaksi ke hover) + tombol panah kecil
//   terpisah di sebelah kanan buat menutup sidebar.
// - TERTUTUP: satu tombol yang nge-crossfade dari logo ke ikon "buka sidebar"
//   pas di-hover/focus — cuma di kondisi ini crossfade-nya aktif.
//
// Di perangkat tanpa hover (touch) saat tertutup, crossfade percuma karena
// nggak ada "hover in/out" — jadi lewat @media(hover:none) di CSS, logo
// statis dan tombol buka SELALU tampil bareng, bukan gantian.
export default function SidebarBrandToggle({ open, onToggle }) {
  if (open) {
    return (
      <div className="sidebar-brand-row">
        <span className="sidebar-logo-fixed" aria-hidden="true">
          <LogoMark size={28} />
        </span>
        <Wordmark />
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggle}
          aria-label="Tutup sidebar"
          aria-expanded="true"
          data-tooltip="Tutup sidebar"
        >
          <Icon name="panelLeftClose" />
        </button>
      </div>
    );
  }

  const label = "Buka sidebar";

  return (
    <div className="sidebar-brand-row">
      <span className="sidebar-logo-static" aria-hidden="true">
        <LogoMark size={28} />
      </span>

      <button
        type="button"
        className="brand-toggle-btn"
        onClick={onToggle}
        aria-label={label}
        aria-expanded="false"
        data-tooltip={label}
      >
        <span className="brand-toggle-face brand-toggle-face-logo">
          <LogoMark size={28} />
        </span>
        <span className="brand-toggle-face brand-toggle-face-icon">
          <Icon name="panelLeftOpen" />
        </span>
      </button>
    </div>
  );
}
