"use client";

import Icon from "@/components/Icon";

const SORT_OPTIONS = [
  { id: "terbaru", label: "Terbaru" },
  { id: "tenggat", label: "Tenggat Terdekat" },
];

export default function ProjectToolbar({
  query, onQueryChange,
  statusOptions, activeStatus, onStatusChange,
  sort, onSortChange,
}) {
  return (
    <div className="project-toolbar mb-16">
      <div className="project-search">
        <Icon name="search" />
        <input
          className="input"
          placeholder="Cari judul atau nama klien..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <div className="row gap-8" style={{ flexWrap: "wrap" }}>
        <button
          type="button"
          className={`chip-filter ${activeStatus === null ? "active" : ""}`}
          onClick={() => onStatusChange(null)}
        >
          Semua Status
        </button>
        {statusOptions.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip-filter ${activeStatus === s.id ? "active" : ""}`}
            onClick={() => onStatusChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <label className="project-sort">
        <Icon name="arrowUpDown" />
        <select className="input" value={sort} onChange={(e) => onSortChange(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
