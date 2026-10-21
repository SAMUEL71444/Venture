"use client";

import Icon from "@/components/Icon";

// Card generik dipakai semua panel Pengaturan: border tipis, radius lembut,
// judul + tombol pensil bulat di pojok kanan atas (`onEdit`, dilewatkan kalau
// card-nya memang bisa diedit). Isinya (`children`) sepenuhnya diatur
// pemanggil — mode baca vs mode edit diputuskan di panel masing-masing,
// card ini cuma nyediain "bingkai"-nya.
// `note` (opsional) = keterangan kecil di kanan atas MENGGANTIKAN pensil untuk
// card read-only (mis. "Dikelola oleh tim internal").
export default function SettingsCard({ title, onEdit, note, children }) {
  return (
    <div className="card settings-card">
      <div className="settings-card-head">
        <h3 className="settings-card-title">{title}</h3>
        {note && <span className="settings-card-note">{note}</span>}
        {onEdit && (
          <button type="button" className="settings-card-edit" onClick={onEdit} aria-label={`Edit ${title}`}>
            <Icon name="pencil" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
