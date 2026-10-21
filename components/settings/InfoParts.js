"use client";

import Icon from "@/components/Icon";
import { initials } from "@/lib/mock-data";

// Bagian kecil yang dipakai bersama panel "Info Saya" semua role
// (UmkmInfoPanel, TrustInfoPanel) — satu komponen, bukan disalin per panel.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const digitsOf = (s) => s.replace(/\D/g, "");

// Tombol kecil "Tampilkan/Sembunyikan" untuk data yang disensor.
export function Reveal({ shown, onToggle, label }) {
  return (
    <button type="button" className="settings-reveal" onClick={onToggle} aria-label={`${shown ? "Sembunyikan" : "Tampilkan"} ${label}`}>
      <Icon name="eye" /> {shown ? "Sembunyikan" : "Tampilkan"}
    </button>
  );
}

// Avatar bulat: inisial kalau sudah ada foto/logo, ikon placeholder kalau belum.
export function Avatar({ name, filled, icon = "user", bg }) {
  return filled ? (
    <div className="avatar settings-avatar" style={bg ? { background: bg } : undefined}>{initials(name)}</div>
  ) : (
    <div className="settings-avatar settings-avatar-placeholder" aria-hidden="true"><Icon name={icon} /></div>
  );
}

export function ModalActions({ onCancel, submitLabel, submitClass = "btn-primary", disabled }) {
  return (
    <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
      <button type="submit" className={`btn ${submitClass}`} disabled={disabled}>{submitLabel}</button>
    </div>
  );
}
