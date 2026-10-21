"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

// Carousel horizontal generik: scroll-snap + tombol panah kiri/kanan yang
// nonaktif di ujung. Bisa di-scroll sentuh/trackpad, dan fokus keyboard
// berpindah antar kartu secara alami (tiap kartu sebaiknya fokusable).
// Tidak tahu isi kartunya — dipakai lewat `children`.
export default function Carousel({ children, label = "Daftar geser" }) {
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children]);

  function scrollBy(dir) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className="carousel">
      <button
        type="button" className="carousel-arrow prev" onClick={() => scrollBy(-1)}
        disabled={edges.start} aria-label="Geser ke kiri"
      >
        <Icon name="chevLeft" />
      </button>
      <div ref={trackRef} className="carousel-track" onScroll={update} role="group" aria-label={label}>
        {children}
      </div>
      <button
        type="button" className="carousel-arrow next" onClick={() => scrollBy(1)}
        disabled={edges.end} aria-label="Geser ke kanan"
      >
        <Icon name="chevRight" />
      </button>
    </div>
  );
}
