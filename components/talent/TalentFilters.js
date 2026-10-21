"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import RateHistogram from "./RateHistogram";
import { TALENT_BADGES } from "@/lib/talents.mock";

// Satu grup filter yang bisa collapse — pola .cc-body/.cc-chev yang sama
// dengan CollapsibleCard (components/ui/CollapsibleCard.js).
function Group({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ft-filter-group">
      <button type="button" className="ft-filter-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{title}</span>
        <span className={`cc-chev ${open ? "open" : ""}`}><Icon name="chevDown" /></span>
      </button>
      <div className={`cc-body ${open ? "open" : ""}`}>
        <div className="cc-body-inner"><div className="ft-filter-body">{children}</div></div>
      </div>
    </div>
  );
}

function Select({ value, onChange, placeholder, options }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// Sidebar filter kiri. State-nya dimiliki FindTalentView — komponen ini
// cuma menampilkan dan memanggil `set(patch)`.
export default function TalentFilters({ filters, set, options, rateBounds, onReset }) {
  const [showAllSkills, setShowAllSkills] = useState(false);
  const skills = showAllSkills ? options.skills : options.skills.slice(0, 6);

  return (
    <aside className="ft-filters card">
      <Group title="Badge Talenta">
        {Object.entries(TALENT_BADGES).map(([key, b]) => (
          <label key={key} className="ft-check">
            <input type="checkbox" checked={filters.badges.includes(key)} onChange={() => set({ badges: toggle(filters.badges, key) })} />
            <Icon name={b.icon} /> {b.label}
          </label>
        ))}
      </Group>

      <Group title="Tarif per Jam">
        <RateHistogram
          rates={options.rates} min={rateBounds[0]} max={rateBounds[1]}
          value={filters.rate} onChange={(rate) => set({ rate })}
        />
      </Group>

      <Group title="Skill">
        {skills.map((s) => (
          <label key={s} className="ft-check">
            <input type="checkbox" checked={filters.skills.includes(s)} onChange={() => set({ skills: toggle(filters.skills, s) })} />
            {s}
          </label>
        ))}
        {options.skills.length > 6 && (
          <button type="button" className="link-btn mt-4" onClick={() => setShowAllSkills((v) => !v)}>
            {showAllSkills ? "Lihat lebih sedikit" : "Lihat lebih banyak"}
          </button>
        )}
      </Group>

      <Group title="Lokasi">
        <Select value={filters.city} onChange={(city) => set({ city })} placeholder="Semua kota" options={options.cities} />
      </Group>

      <Group title="Zona Waktu" defaultOpen={false}>
        <Select value={filters.timezone} onChange={(timezone) => set({ timezone })} placeholder="Semua zona waktu" options={options.timezones} />
      </Group>

      <Group title="Status Ketersediaan">
        {[["semua", "Semua"], ["terbuka", "Terbuka untuk kerja"]].map(([v, label]) => (
          <label key={v} className="ft-check">
            <input type="radio" name="ft-availability" checked={filters.availability === v} onChange={() => set({ availability: v })} />
            {label}
          </label>
        ))}
      </Group>

      <Group title="Kategori">
        <Select value={filters.category} onChange={(category) => set({ category })} placeholder="Semua kategori" options={options.categories} />
      </Group>

      <Group title="Tingkat Keberhasilan" defaultOpen={false}>
        <select className="input" value={filters.success} onChange={(e) => set({ success: Number(e.target.value) })}>
          <option value={0}>Semua</option>
          <option value={80}>80% ke atas</option>
          <option value={90}>90% ke atas</option>
        </select>
      </Group>

      <Group title="Universitas" defaultOpen={false}>
        <Select value={filters.uni} onChange={(uni) => set({ uni })} placeholder="Semua universitas" options={options.unis} />
      </Group>

      <button type="button" className="btn btn-secondary btn-sm btn-block mt-12" onClick={onReset}>Reset filter</button>
    </aside>
  );
}
