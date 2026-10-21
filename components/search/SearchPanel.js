"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useSearchPanel } from "@/context/SearchPanelContext";
import { PROJECTS } from "@/lib/mock-data";
import { getAllProjects } from "@/lib/projects.mock";

const SUGGESTIONS = [
  "Desain logo usaha",
  "Konten Instagram bulanan",
  "Website company profile",
  "Setup toko Shopee",
  "Pembukuan UMKM",
  "Cara mengajukan proposal",
];

const SCOPES = [
  { id: "proyek", label: "Proyek" },
  { id: "proyek-saya", label: "Proyek Saya" },
];

// Panel pencarian gaya Upwork: bukan modal di tengah layar, tapi panel besar
// yang "menempel" di atas area konten, dengan overlay gelap yang cuma nutup
// konten — sidebar-nya sendiri tetap terang. Makanya `sidebarWidth` dikirim
// dari Sidebar.js, supaya posisi kiri panel ini otomatis ngikutin lebar
// sidebar terbuka/tertutup.
export default function SearchPanel({ sidebarWidth }) {
  const { isOpen, initialQuery, closeSearch } = useSearchPanel();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState("proyek");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialQuery);
    setActiveIndex(-1);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen, initialQuery]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e) {
      if (e.key === "Escape") closeSearch();
    }
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, closeSearch]);

  const pool = scope === "proyek" ? PROJECTS : getAllProjects();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return pool
      .filter((p) => {
        const haystack = [p.title, p.umkm || p.client, p.category, ...(p.skills || [])].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 6);
  }, [pool, query]);

  const optionCount = query.trim() ? results.length : SUGGESTIONS.length;

  function destinationFor(text) {
    return scope === "proyek"
      ? `/dashboard?q=${encodeURIComponent(text)}`
      : `/projects?tab=semua&q=${encodeURIComponent(text)}`;
  }

  function goTo(text) {
    closeSearch();
    router.push(destinationFor(text));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (activeIndex >= 0 && query.trim() && results[activeIndex]) {
      goTo(results[activeIndex].title);
    } else if (activeIndex >= 0 && !query.trim() && SUGGESTIONS[activeIndex]) {
      goTo(SUGGESTIONS[activeIndex]);
    } else if (query.trim()) {
      goTo(query.trim());
    }
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, optionCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="search-overlay" style={{ left: sidebarWidth }} onClick={closeSearch} aria-hidden="true" />
      <div
        className="search-panel"
        style={{ left: sidebarWidth }}
        role="dialog"
        aria-modal="true"
        aria-label="Cari proyek"
      >
        <form onSubmit={handleSubmit}>
          <div className="search-input-row">
            <Icon name="search" />
            <input
              ref={inputRef}
              className="search-input"
              placeholder="Cari proyek berdasarkan keahlian, kategori, atau nama UMKM..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
            />
            <select
              className="search-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              aria-label="Cakupan pencarian"
            >
              {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button type="button" className="icon-btn" onClick={closeSearch} aria-label="Tutup pencarian">
              <Icon name="close" />
            </button>
          </div>
        </form>

        <div className="search-body">
          {query.trim() ? (
            results.length === 0 ? (
              <p className="t-small muted" style={{ padding: "8px 4px" }}>Tidak ada hasil untuk &ldquo;{query}&rdquo;.</p>
            ) : (
              results.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  className={`search-result ${activeIndex === i ? "active" : ""}`}
                  onClick={() => goTo(item.title)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="search-result-icon"><Icon name="briefcase" /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="t-small" style={{ fontWeight: 600 }}>{item.title}</div>
                    <div className="t-caption">{item.umkm || item.client} · {item.category}</div>
                  </div>
                </button>
              ))
            )
          ) : (
            <>
              <div className="search-section-label">
                <Icon name="lightbulb" /> Coba cari
              </div>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={`search-suggestion ${activeIndex === i ? "active" : ""}`}
                  onClick={() => goTo(s)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {s}
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
