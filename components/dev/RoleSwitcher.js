"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { ROLES } from "@/config/roles";
import { useRole } from "@/context/RoleContext";

// SHOW_ROLE_SWITCHER: true buat prototipe ini, biar reusability antar role
// gampang dicek tanpa backend/login beneran. Set `false` di sini kalau mau
// disembunyikan tanpa mencabut komponennya.
const SHOW_ROLE_SWITCHER = null;

// Pil kecil pojok KIRI bawah (kanan bawah sudah dipakai bubble chat, lihat
// components/messages/ChatWidget.js) — "Lihat sebagai: <role>". Klik role
// lain -> setRole() dari RoleContext, yang otomatis dibaca AppShell
// (sidebar/popup profil) dan RoleGuard (akses halaman) di semua tempat.
export default function RoleSwitcher() {
  const { role, setRole } = useRole();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!SHOW_ROLE_SWITCHER || !role) return null;

  return (
    <div className="role-switcher-wrap" ref={wrapRef}>
      {open && (
        <div className="role-switcher-panel card">
          <div className="t-caption mb-8">LIHAT SEBAGAI</div>
          {Object.values(ROLES).map((r) => (
            <button
              key={r.key}
              type="button"
              className={`role-switcher-item ${role === r.key ? "active" : ""}`}
              onClick={() => { setRole(r.key); setOpen(false); }}
            >
              <span>{r.label}</span>
              {role === r.key && <Icon name="check" />}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="role-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="users" />
        <span>Lihat sebagai: {ROLES[role]?.label}</span>
        <Icon name="chevDown" />
      </button>
    </div>
  );
}
