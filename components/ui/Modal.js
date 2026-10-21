"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import useFocusTrap from "./useFocusTrap";

const TRANSITION_MS = 180;

// Modal generik di tengah layar: overlay gelap + panel yang muncul dengan
// fade & scale kecil. Tutup lewat Esc, klik overlay, atau tombol ×. Pola
// mount/animasi sama dengan Drawer.js. z-index-nya di atas drawer, jadi
// modal bisa dibuka dari dalam panel detail (mis. "Ajak" di panel talent).
export default function Modal({ open, onClose, title, children, width = 560 }) {
  const [mounted, setMounted] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);
  const panelRef = useRef(null);
  // Fokus keyboard terkunci di dalam modal selama terbuka (Tab berputar).
  useFocusTrap(panelRef, mounted);

  useEffect(() => {
    let raf;
    let closeTimer;
    if (open) {
      setMounted(true);
      raf = requestAnimationFrame(() => setAnimateIn(true));
    } else {
      setAnimateIn(false);
      closeTimer = setTimeout(() => setMounted(false), TRANSITION_MS);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(closeTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    // capture: Esc menutup modal duluan, bukan drawer di belakangnya.
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose?.();
    };
    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div className={`modal-overlay ${animateIn ? "open" : ""}`} onClick={onClose}>
      <div
        ref={panelRef}
        className={`modal-panel ${animateIn ? "open" : ""}`}
        style={{ width: `min(${width}px, 94vw)` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="t-h2">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
