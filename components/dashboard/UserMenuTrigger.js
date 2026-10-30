"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UserMenu from "./UserMenu";
import { initials } from "@/lib/mock-data";
import { useRole } from "@/context/RoleContext";
import { logout } from "@/lib/auth/api";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 150;

// Popup bisa dibuka dua cara: hover (dengan delay kecil biar nggak
// "kedip" pas kursor cuma numpang lewat) ATAU klik (yang "nge-pin" popup
// supaya nggak ketutup lagi walau kursor pindah-pindah). Klik di luar
// atau Esc selalu menutup + lepas pin, apapun cara buka-nya.
//
// `user` selalu dikirim AppShell (dari RoleContext) — nggak ada lagi
// default lokal di sini, karena AppShell sendiri udah nahan render sampai
// role & user-nya siap (lihat components/layout/AppShell.js).
//
// Layar sentuh: hover hanya untuk mouse sungguhan (pointerType "mouse"), jadi ketukan
// selalu lewat klik; ketukan di luar menu menutupnya (pointerdown).
// `placement="header"`: tombol avatar di bar atas mobile (AppShell), popup turun ke
// bawah-kanan dan tidak terpotong drawer.
export default function UserMenuTrigger({ user, sidebarOpen, placement = "sidebar" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [online, setOnline] = useState(true);
  const wrapRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const router = useRouter();
  const { setRole, config } = useRole();

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleMouseEnter = (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimers();
    openTimer.current = setTimeout(() => setMenuOpen(true), OPEN_DELAY);
  };

  const handleMouseLeave = (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimers();
    if (pinned) return; // klik yang buka popup ini, biarkan sampai ditutup eksplisit
    closeTimer.current = setTimeout(() => setMenuOpen(false), CLOSE_DELAY);
  };

  function handleTriggerClick() {
    clearTimers();
    setMenuOpen((wasOpen) => {
      const next = !wasOpen;
      setPinned(next);
      return next;
    });
  }

  function closeMenu() {
    clearTimers();
    setMenuOpen(false);
    setPinned(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) closeMenu();
    }
    function onKeyDown(e) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function handleLogout() {
    // Cabut refresh token di backend (tanpa menunggu) lalu hapus sesi lokal.
    logout();
    setRole(null);
    closeMenu();
    router.push("/");
  }

  const header = placement === "header";

  return (
    <div
      className={`user-menu-trigger-wrap ${header ? "user-menu-trigger-wrap--header" : ""}`}
      ref={wrapRef}
      onPointerEnter={handleMouseEnter}
      onPointerLeave={handleMouseLeave}
    >
      <button
        type="button"
        className={`user-menu-trigger ${header ? "user-menu-trigger--header" : ""}`}
        onClick={handleTriggerClick}
        aria-label="Menu akun"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <div className="avatar avatar-sm" style={{ background: user.avatarBg || "var(--primary-light)" }}>
          {initials(user.name)}
        </div>
       {sidebarOpen && !header && (
            <div style={{ minWidth: 0, overflow: "hidden", textAlign: "left" }}>
                <div className="t-small" style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>
                {user.name}
                </div>
                <div className="t-caption" style={{ color: "var(--text-faint)", whiteSpace: "nowrap", overflow: "hidden" }}>
                {user.plan}
                </div>
            </div>
            )}
      </button>

      {menuOpen && (
        <UserMenu
          className={header ? "user-menu--header" : ""}
          user={user}
          profileMenu={config?.profileMenu}
          showOnlineToggle={config?.features?.onlineToggle}
          onlineForMessages={online}
          onToggleOnline={() => setOnline((v) => !v)}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
