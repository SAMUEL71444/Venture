"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/dashboard/SideBar";
import RoleGuard from "./RoleGuard";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import useFocusTrap from "@/components/ui/useFocusTrap";
import { navFor } from "@/config/roles";
import { useRole } from "@/context/RoleContext";

// Shell tunggal buat semua role: sidebar (menu dari navFor(role), user dari
// context) + canvas konten, dibungkus RoleGuard supaya halaman yang nggak
// boleh diakses role aktif otomatis ketutup pesan "Tidak memiliki akses"
// tanpa tiap halaman ngecek sendiri-sendiri.
//
// Responsif (CSS di globals.css bagian 41):
// - < md (768px): sidebar jadi drawer off-canvas, dibuka lewat tombol menu di
//   bar atas; tertutup lewat Esc, klik backdrop, tombol tutup, atau saat
//   memilih menu. Fokus keyboard terkunci di dalam drawer selama terbuka.
// - md–lg: sidebar mulai sebagai rail (72px); >= lg: mulai terbuka.
// - Konten dibatasi --container-wide (1440px) dan berada di tengah.
//
// Drawer/toast milik satu halaman TETAP dirender di page.js masing-masing,
// sebagai sibling <AppShell>, bukan lewat AppShell.
//
// `bare` — dipakai /messages: main tanpa padding (chat-layout ngatur tinggi
// & isinya sendiri).
const MOBILE_QUERY = "(max-width: 767.98px)";
const DESKTOP_QUERY = "(min-width: 1024px)";

const matches = (q) => typeof window !== "undefined" && window.matchMedia(q).matches;

function useMediaQuery(query) {
  const [value, setValue] = useState(() => matches(query));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setValue(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return value;
}

export default function AppShell({ children, aside, bare = false }) {
  // AppShell baru dirender di klien (role dibaca dari localStorage setelah
  // mount, lihat return null di bawah), jadi membaca matchMedia di initial
  // state aman dari hydration mismatch.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window === "undefined" || matches(DESKTOP_QUERY));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { role, user } = useRole();
  const sidebarRef = useRef(null);

  const closeMobileNav = () => setMobileNavOpen(false);
  useFocusTrap(sidebarRef, isMobile && mobileNavOpen, { onEscape: closeMobileNav });

  // Pindah ke ukuran tablet/desktop saat drawer terbuka → tutup drawer.
  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  // Halaman di belakang drawer tidak ikut ter-scroll.
  useEffect(() => {
    if (!(isMobile && mobileNavOpen)) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMobile, mobileNavOpen]);

  // Sekejap di render pertama sebelum RoleProvider sempat baca localStorage
  // (lihat context/RoleContext.js) — dibiarkan kosong daripada nge-crash
  // karena `user`/`navFor(null)` belum ada isinya.
  if (!role || !user) return null;

  return (
    <div className="dash-shell">
      {isMobile && (
        <header className="dash-mobilebar">
          <button
            type="button"
            className="dash-menu-btn"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Buka menu navigasi"
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link href="/dashboard" className="dash-mobilebar-brand" aria-label="Digital.in — dashboard">
            <LogoMark size={28} /><Wordmark />
          </Link>
        </header>
      )}

      <Sidebar
        id="app-sidebar"
        ref={sidebarRef}
        open={isMobile ? true : sidebarOpen}
        mobile={isMobile}
        mobileOpen={mobileNavOpen}
        onToggle={isMobile ? closeMobileNav : () => setSidebarOpen((v) => !v)}
        onNavigate={isMobile ? closeMobileNav : undefined}
        navItems={navFor(role)}
        user={user}
      />
      {isMobile && mobileNavOpen && <div className="dash-backdrop" onClick={closeMobileNav} aria-hidden="true" />}

      <div className="dash-canvas">
        <div className={`dash-inner ${aside ? "has-aside" : ""}`}>
          <main className={`dash-main ${bare ? "bare" : ""}`}>
            <RoleGuard>{children}</RoleGuard>
          </main>
          {aside && <div className="dash-aside">{aside}</div>}
        </div>
      </div>
    </div>
  );
}
