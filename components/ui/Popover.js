"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 150;

// Popover generik: bisa dibuka lewat hover (delay kecil biar nggak "kedip"
// pas kursor numpang lewat) ATAU klik (yang "nge-pin" popover supaya nggak
// ketutup lagi walau kursor pindah-pindah). Klik di luar atau Esc selalu
// menutup + lepas pin. Pola yang sama dipakai di UserMenuTrigger — di sini
// ditulis ulang generik supaya bisa dipakai di tempat lain juga (mis. menu
// section "Proyek Saya"), tanpa mengubah UserMenuTrigger yang sudah ada.
//
// `trigger` nerima ({open, onClick}) dan balikin elemen tombolnya sendiri —
// jadi pemanggil yang atur aria-haspopup/aria-expanded/isi tombol.
// `align`: "start" (rata kiri, default) atau "end" (rata kanan) relatif ke
// trigger, supaya popover nggak keluar layar kalau triggernya di dekat tepi.
export default function Popover({ trigger, children, align = "start", panelClassName = "" }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [placeUp, setPlaceUp] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const handleMouseEnter = () => {
    clearTimers();
    openTimer.current = setTimeout(() => setOpen(true), OPEN_DELAY);
  };

  const handleMouseLeave = () => {
    clearTimers();
    if (pinned) return;
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  // Klik saat popover sudah terbuka karena hover = "pin" (tetap terbuka),
  // bukan menutup — kalau tidak, gerakan alami hover-lalu-klik malah menutupnya.
  // Klik saat sudah ter-pin baru menutup.
  function handleTriggerClick() {
    clearTimers();
    if (open && !pinned) {
      setPinned(true);
      return;
    }
    const next = !open;
    setOpen(next);
    setPinned(next);
  }

  // Kalau ruang di bawah trigger tidak cukup (mis. kartu terakhir di
  // halaman) dan di atas lebih lega, buka popover ke atas.
  useLayoutEffect(() => {
    if (!open) {
      setPlaceUp(false);
      return;
    }
    const wrap = wrapRef.current;
    const panel = panelRef.current;
    if (!wrap || !panel) return;
    const t = wrap.getBoundingClientRect();
    const needed = panel.offsetHeight + 8;
    const below = window.innerHeight - t.bottom;
    setPlaceUp(below < needed && t.top > below);
  }, [open]);

  function close() {
    clearTimers();
    setOpen(false);
    setPinned(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    }
    function onKeyDown(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      className="popover-wrap"
      ref={wrapRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {trigger({ open, onClick: handleTriggerClick, close })}
      {open && (
        <div
          ref={panelRef}
          className={`popover ${align === "end" ? "popover-end" : ""} ${placeUp ? "popover-up" : ""} ${panelClassName}`.trim()}
          onClick={(e) => e.stopPropagation()}
        >
          {children({ close })}
        </div>
      )}
    </div>
  );
}
