"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Icon from "@/components/Icon";
import Accordion from "@/components/ui/Accordion";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import ProjectsEmptyState from "@/components/projects/ProjectsEmptyState";
import { HELP_CATEGORIES } from "@/lib/help.mock";
import { useRole } from "@/context/RoleContext";
import { can } from "@/config/roles";

const POPULAR = ["escrow", "verifikasi", "penarikan dana"];

// Pusat Bantuan: hero banner (foto + search besar + chip populer) di atas,
// lalu filter kategori dan daftar FAQ (accordion) — fungsinya tidak berubah,
// cuma search bar-nya pindah ke dalam banner. Card "Masih butuh bantuan?" di
// bawah, "Hubungi Support" diarahkan ke /messages kalau role ini punya akses
// chat (freelancer/UMKM); Verify & Trust nggak punya chat (lihat
// config.features.chatWidget), jadi jatuh ke mailto.
// `?kategori=<id>` dan `?q=<kata>` (dari kartu "Bantuan & Sumber Daya" di
// dashboard UMKM) membuka halaman ini langsung terfilter. useSearchParams
// wajib dibungkus <Suspense> di App Router.
export default function HelpView() {
  return (
    <Suspense fallback={null}>
      <HelpContent />
    </Suspense>
  );
}

function HelpContent() {
  const { role } = useRole();
  const searchParams = useSearchParams();
  const initialCategory = HELP_CATEGORIES.some((c) => c.id === searchParams.get("kategori")) ? searchParams.get("kategori") : "semua";
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const bodyRef = useRef(null);

  const hasChat = can(role, "use_chat");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_CATEGORIES
      .filter((c) => activeCategory === "semua" || c.id === activeCategory)
      .map((c) => ({
        ...c,
        questions: c.questions.filter((item) =>
          !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.questions.length > 0);
  }, [query, activeCategory]);

  const totalResults = filtered.reduce((n, c) => n + c.questions.length, 0);

  function scrollToResults() {
    bodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitSearch(e) {
    e.preventDefault();
    scrollToResults();
  }

  function searchPopular(term) {
    setQuery(term);
    setActiveCategory("semua");
    scrollToResults();
  }

  return (
    <>
      <section className="help-hero">
        <div className="help-hero-overlay" />
        <div className="help-hero-content">
          <div className="help-hero-brand">
            <LogoMark size={26} />
            <Wordmark className="help-hero-wordmark" />
          </div>
          <div className="help-hero-label">Pusat Bantuan</div>
          <h1 className="help-hero-title">Temukan solusi dengan cepat.</h1>
          <p className="help-hero-sub">Cari ratusan artikel bantuan di Digital.in.</p>

          <form className="help-hero-search" onSubmit={submitSearch}>
            <input
              type="text"
              placeholder="Cari artikel..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari artikel"
            />
            <button type="submit" aria-label="Cari">
              <Icon name="search" />
            </button>
          </form>

          <div className="help-hero-popular">
            <span>Populer:</span>
            {POPULAR.map((term) => (
              <button key={term} type="button" className="help-hero-chip" onClick={() => searchPopular(term)}>
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div ref={bodyRef} className="help-body">
        <div className="row gap-8" style={{ flexWrap: "wrap" }}>
          <button type="button" className={`chip-filter ${activeCategory === "semua" ? "active" : ""}`} onClick={() => setActiveCategory("semua")}>
            Semua
          </button>
          {HELP_CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`chip-filter ${activeCategory === c.id ? "active" : ""}`} onClick={() => setActiveCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>

        {totalResults === 0 ? (
          <ProjectsEmptyState
            variant="no-results"
            title="Tidak ada hasil"
            subtitle={`Tidak ada pertanyaan yang cocok dengan "${query}". Coba kata kunci lain atau pilih kategori berbeda.`}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {filtered.map((c) => (
              <div key={c.id}>
                <h2 className="t-h3 mb-8" style={{ fontSize: 16 }}>{c.label}</h2>
                <Accordion items={c.questions} />
              </div>
            ))}
          </div>
        )}

        <div className="card card-pad help-contact">
          <div className="t-h3" style={{ fontSize: 16 }}>Masih butuh bantuan?</div>
          <p className="t-small muted mt-8">Tim kami siap membantu kalau jawaban di atas belum cukup.</p>
          {hasChat ? (
            <Link href="/messages" className="btn btn-primary mt-12">Hubungi Support</Link>
          ) : (
            <a href="mailto:support@digitalin.id" className="btn btn-primary mt-12">Hubungi Support</a>
          )}
        </div>
      </div>
    </>
  );
}
