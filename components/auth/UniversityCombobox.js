"use client";

// Combobox universitas di form daftar mahasiswa: ketik untuk memfilter daftar
// (nama & singkatan, tanpa beda huruf besar/kecil) yang dimuat sekali dari
// GET /universities. Keyboard: ↑/↓ memilih, Enter memakai, Esc menutup.
// Opsi terakhir selalu "Universitas saya tidak ada di daftar" (UNIVERSITY_CUSTOM).
import { useEffect, useMemo, useRef, useState } from "react";
import { UNIVERSITY_CUSTOM } from "@/lib/auth/validation";

const CUSTOM_LABEL = "Universitas saya tidak ada di daftar";
const labelOf = (u) => (u.short_name ? `${u.name} (${u.short_name})` : u.name);

export default function UniversityCombobox({ id, name, universities, value, onChange, onBlur, invalid, describedBy }) {
  const selected = value === UNIVERSITY_CUSTOM
    ? CUSTOM_LABEL
    : (() => { const u = universities.find((x) => x.id === value); return u ? labelOf(u) : ""; })();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected);
  const [filter, setFilter] = useState(""); // teks yang benar-benar diketik pengguna
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const listId = `${id}-listbox`;

  // Saat tertutup, isian menampilkan pilihan yang sedang berlaku.
  useEffect(() => {
    if (!open) setQuery(selected);
  }, [selected, open]);

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matches = q
      ? universities.filter((u) => u.name.toLowerCase().includes(q) || (u.short_name || "").toLowerCase().includes(q))
      : universities;
    return [
      ...matches.map((u) => ({ value: u.id, label: labelOf(u), meta: u.city })),
      { value: UNIVERSITY_CUSTOM, label: CUSTOM_LABEL, custom: true },
    ];
  }, [universities, filter]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openList() {
    if (open) return;
    const current = options.findIndex((o) => o.value === value);
    setActive(current >= 0 ? current : 0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setFilter("");
  }

  function choose(option) {
    onChange(option.value);
    close();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openList();
      else setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openList();
      else setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  }

  const noMatches = options.length === 1;

  return (
    <div className="au-combo">
      <input
        id={id} name={name} type="text" className="input au-input" autoComplete="off" spellCheck={false}
        placeholder="Ketik nama atau singkatan, mis. UI, ITB, BINUS"
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid || undefined} aria-describedby={describedBy}
        value={query}
        onFocus={openList}
        onClick={openList}
        onChange={(e) => {
          setQuery(e.target.value);
          setFilter(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          close();
          onBlur?.();
        }}
      />
      {open && (
        <ul ref={listRef} id={listId} role="listbox" className="au-combo-list" aria-label="Daftar universitas">
          {noMatches && <li role="presentation" className="au-combo-empty">Tidak ada universitas yang cocok.</li>}
          {options.map((o, i) => (
            <li
              key={o.value} id={`${id}-opt-${i}`} data-index={i} role="option" aria-selected={o.value === value}
              className={`au-combo-option ${i === active ? "active" : ""} ${o.custom ? "au-combo-custom" : ""}`}
              // mousedown, bukan click: mencegah input kehilangan fokus sebelum pilihan tercatat.
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{o.label}</span>
              {o.meta && <span className="au-combo-meta">{o.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
