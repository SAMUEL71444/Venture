"use client";

// Navigasi kiri halaman Pengaturan, dikelompokkan per grup (config.settingsNav
// — lihat config/roles.js) dengan heading grup, gaya Upwork: item aktif
// dapat border kiri + warna beda. Di ≤760px berubah jadi <select> (lihat CSS
// .settings-nav / .settings-nav-select, app/globals.css section 31).
export default function SettingsNav({ groups, active, onSelect }) {
  return (
    <nav className="settings-nav">
      {groups.map((g) => (
        <div key={g.title} className="settings-nav-group">
          <div className="settings-nav-heading">{g.title}</div>
          {g.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav-item ${active === item.id ? "active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <span>{item.label}</span>
              {item.badge && <span className="badge badge-dark">{item.badge}</span>}
            </button>
          ))}
        </div>
      ))}

      {/* Versi mobile — select polos berisi optgroup per grup yang sama. */}
      <select
        className="input settings-nav-select"
        value={active}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Navigasi pengaturan"
      >
        {groups.map((g) => (
          <optgroup key={g.title} label={g.title}>
            {g.items.map((item) => (
              <option key={item.id} value={item.id}>{item.label}{item.badge ? ` (${item.badge})` : ""}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </nav>
  );
}
