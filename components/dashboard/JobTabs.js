"use client";

import { useEffect, useRef, useState } from "react";

const TABS = [
  { id: "best", label: "Best Matches" },
  { id: "recent", label: "Most Recent" },
  { id: "saved", label: "Saved Jobs" },
  { id: "invites", label: "Invites" },
];

export default function JobTabs({ active, onChange }) {
  const containerRef = useRef(null);
  const btnRefs = useRef({});
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  // Ukur posisi tombol yang aktif tiap kali `active` berubah, atau window di-resize.
  // Ini yang bikin underline-nya bisa geser mengikuti tombol mana pun, bukan cuma
  // pindah ke posisi yang sudah di-hardcode.
  useEffect(() => {
    const measure = () => {
      const btn = btnRefs.current[active];
      const container = containerRef.current;
      if (!btn || !container) return;
      const btnRect = btn.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setUnderline({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active]);

  return (
    <div ref={containerRef} className="job-tabs">
      {TABS.map((t) => (
        <button
          key={t.id}
          ref={(el) => (btnRefs.current[t.id] = el)}
          onClick={() => onChange(t.id)}
          className={`job-tab ${active === t.id ? "active" : ""}`}
        >
          {t.label}
        </button>
      ))}
      <span
        className="job-tab-underline"
        style={{ left: underline.left, width: underline.width }}
      />
    </div>
  );
}