"use client";

import { useId, useState } from "react";
import Icon from "@/components/Icon";

// Card yang bisa di-expand/collapse lewat klik judulnya — dipakai sidebar
// dashboard freelancer (ProfileSidePanel) dan halaman Pusat Bantuan.
// Transisi tinggi pakai grid-template-rows 0fr -> 1fr (lihat .cc-body di
// globals.css), bukan max-height, supaya tidak perlu angka tinggi tetap.
export default function CollapsibleCard({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="card cc-card">
      <button
        type="button"
        className="cc-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="t-h3" style={{ fontSize: 15 }}>{title}</span>
        <span className={`cc-chev ${open ? "open" : ""}`}><Icon name="chevDown" /></span>
      </button>
      <div id={bodyId} className={`cc-body ${open ? "open" : ""}`}>
        <div className="cc-body-inner">{children}</div>
      </div>
    </div>
  );
}
