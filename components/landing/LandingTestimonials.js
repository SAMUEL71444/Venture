"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconStar, IconChevronDown } from "./LandingIcons";
import { TESTIMONIALS, INITIAL_TESTIMONIAL_COUNT } from "@/lib/testimonials.mock";

const initialsOf = (name) => name.split(" ").map((n) => n[0]).join("").slice(0, 2);

// Selaras dengan @keyframes lp-quote-in / lp-quote-out di app/landing.css.
const DURATION = 320;   // ms per kartu
const ENTER_STAGGER = 70; // jeda antar kartu saat muncul
const EXIT_STAGGER = 35;  // jeda antar kartu saat menutup (dari yang terakhir)

// useLayoutEffect di browser (sebelum paint), useEffect di server — komponen
// ini ikut di-SSR, dan React 18 memperingatkan useLayoutEffect di server.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function StoryCard({ t, className = "", style }) {
  return (
    <figure className={`lp-card lp-quote ${className}`} style={style}>
      <div className="lp-stars" role="img" aria-label={`Rating ${t.rating} dari 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <IconStar key={i} size={16} className={i <= t.rating ? undefined : "lp-star-off"} />
        ))}
      </div>
      <blockquote>“{t.quote}”</blockquote>
      <figcaption>
        <span className={`lp-av lp-av-${t.tone}`} aria-hidden="true">{initialsOf(t.name)}</span>
        <div>
          <p className="lp-quote-name">{t.name}</p>
          <p className="lp-quote-role">{t.role}</p>
        </div>
      </figcaption>
    </figure>
  );
}

// Section "Cerita mereka": INITIAL_TESTIMONIAL_COUNT cerita selalu tampil,
// sisanya muncul bertahap (fade + slide naik) lewat tombol. Saat ditutup,
// kartu tambahan dianimasikan keluar dulu (fase "closing") baru di-unmount.
export default function LandingTestimonials() {
  const [phase, setPhase] = useState("closed"); // "closed" | "open" | "closing"
  const timer = useRef(null);
  const buttonRef = useRef(null);
  // Posisi tombol di layar saat "Tampilkan lebih sedikit" diklik.
  const anchorTop = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Setelah kartu tambahan di-unmount (sudah ter-commit, sebelum paint),
  // geser scroll sebesar perubahan posisi tombol — tombol tetap di tempat
  // yang sama di layar, bukan terlempar ke atas karena daftarnya memendek.
  useIsoLayoutEffect(() => {
    if (phase !== "closed" || anchorTop.current == null) return;
    const btn = buttonRef.current;
    if (btn) window.scrollBy(0, btn.getBoundingClientRect().top - anchorTop.current);
    anchorTop.current = null;
  }, [phase]);

  const initial = TESTIMONIALS.slice(0, INITIAL_TESTIMONIAL_COUNT);
  const extra = TESTIMONIALS.slice(INITIAL_TESTIMONIAL_COUNT);
  const expanded = phase === "open";

  function toggle() {
    clearTimeout(timer.current);
    if (phase !== "open") {
      setPhase("open");
      return;
    }
    anchorTop.current = buttonRef.current?.getBoundingClientRect().top ?? null;
    setPhase("closing");
    timer.current = setTimeout(
      () => setPhase("closed"),
      reducedMotion() ? 0 : DURATION + (extra.length - 1) * EXIT_STAGGER
    );
  }

  return (
    <section className="lp-section lp-alt">
      <div className="lp-x">
        <div style={{ maxWidth: 672 }}>
          <span className="lp-eyebrow">Cerita mereka</span>
          <h2 className="lp-h2">Usaha tumbuh, mahasiswa berkembang.</h2>
        </div>

        <div id="lp-stories" className="lp-grid c3">
          {initial.map((t) => <StoryCard key={t.id} t={t} />)}
          {phase !== "closed" && extra.map((t, i) => (
            <StoryCard
              key={t.id}
              t={t}
              className={phase === "closing" ? "lp-quote-exit" : "lp-quote-enter"}
              style={{
                animationDelay: `${phase === "closing" ? (extra.length - 1 - i) * EXIT_STAGGER : i * ENTER_STAGGER}ms`,
              }}
            />
          ))}
        </div>

        {extra.length > 0 && (
          <div className="lp-more">
            <button
              ref={buttonRef}
              type="button"
              className="lp-btn lp-btn-md lp-btn-outline"
              onClick={toggle}
              aria-expanded={expanded}
              aria-controls="lp-stories"
            >
              {expanded ? "Tampilkan lebih sedikit" : "Tampilkan lebih banyak"}
              <IconChevronDown size={18} className={`lp-more-chev ${expanded ? "open" : ""}`} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
