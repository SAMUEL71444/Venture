"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import useFocusTrap from "./useFocusTrap";

const TRANSITION_MS = 320;

// Drawer generik: slide-in dari kanan + overlay. Tidak tahu apa-apa soal
// job/project — kontennya sepenuhnya lewat `children`, jadi bisa dipakai
// ulang untuk detail proyek, detail aplikasi, dsb. `header` (opsional)
// menggantikan header default judul + tombol tutup, mis. panel detail
// talent yang butuh tombol "← kembali" dan link di kanan.
export default function Drawer({ open, onClose, title, children, width = 460, header }) {
  const [mounted, setMounted] = useState(open);
  const [animateIn, setAnimateIn] = useState(false);
  const panelRef = useRef(null);
  // Fokus keyboard terkunci di dalam drawer selama terbuka (Tab berputar).
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
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <>
      <div
        className={`drawer-overlay ${animateIn ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`drawer-panel ${animateIn ? "open" : ""}`}
        style={{ width: `min(${width}px, 92vw)` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {header || (
          <div className="drawer-header">
            <div className="t-h3">{title}</div>
            <button className="icon-btn" onClick={onClose} aria-label="Tutup panel">
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
