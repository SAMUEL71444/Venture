"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { IconMenu, IconX } from "./LandingIcons";
import LandingThemeToggle from "./LandingThemeToggle";

const LINKS = [
  { label: "Cara Kerja", href: "#cara-kerja" },
  { label: "Untuk UMKM", href: "#untuk-umkm" },
  { label: "Untuk Mahasiswa", href: "#untuk-mahasiswa" },
  { label: "Kategori", href: "#kategori" },
];

// Logo sama dengan Sidebar Dashboard (LogoMark + Wordmark). "Masuk" → /login
// (halaman login yang sudah ada), "Mulai gratis" → /choose-type. Toggle tema
// (LandingThemeToggle) memakai ThemeContext yang sama dengan Dashboard.
//
// Responsif: menu horizontal penuh mulai lg (1024px); di bawahnya tombol
// hamburger membuka panel menu (animasi di landing.css). Toggle tema selalu
// tampil di bar. Menu tertutup lewat tombol ×, Esc (fokus kembali ke tombol
// menu), klik di luar header, memilih tautan, atau saat layar melebar ke lg.
export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef(null);
  const burgerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        burgerRef.current?.focus();
      }
    }
    function onPointerDown(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) setOpen(false);
    }
    const mq = window.matchMedia("(min-width: 1024px)");
    const onWide = () => mq.matches && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="lp-header" ref={headerRef}>
      <div className="lp-x lp-header-in">
        <Link href="/" className="lp-brand" aria-label="Digital.in — beranda">
          <LogoMark size={34} />
          <Wordmark />
        </Link>
        <nav className="lp-nav" aria-label="Navigasi utama">
          {LINKS.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}
        </nav>
        {/* Toggle tema selalu tampil (desktop & mobile), di kiri Masuk/Daftar
            atau di kiri tombol hamburger. */}
        <div className="lp-right">
          <LandingThemeToggle />
          <div className="lp-actions">
            <Link href="/login" className="lp-login">Masuk</Link>
            <Link href="/choose-type" className="lp-btn lp-btn-md lp-btn-primary">Mulai gratis</Link>
          </div>
          <button
            ref={burgerRef}
            type="button"
            className="lp-burger"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="lp-mobile-menu"
          >
            {open ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </div>
      <div id="lp-mobile-menu" className={`lp-mobile ${open ? "open" : ""}`}>
        <nav aria-label="Navigasi seluler">
          <div className="lp-mobile-in">
            {LINKS.map((l) => <a key={l.href} href={l.href} onClick={close}>{l.label}</a>)}
            <div className="lp-mobile-actions">
              <Link href="/login" className="lp-btn lp-btn-lg lp-btn-outline" onClick={close}>Masuk</Link>
              <Link href="/choose-type" className="lp-btn lp-btn-lg lp-btn-primary" onClick={close}>Daftar gratis</Link>
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
