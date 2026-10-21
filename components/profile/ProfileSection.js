"use client";

import Icon from "@/components/Icon";

// Tombol bulat kecil (+ / pensil / hapus) dipakai semua section profil.
export function IconBtn({ icon, label, onClick, danger }) {
  return (
    <button type="button" className={`fp-icon-btn ${danger ? "danger" : ""}`} onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} />
    </button>
  );
}

// Bingkai section profil: judul di kiri, tombol + / pensil di kanan atas
// (cuma muncul kalau `editable`, jadi otomatis hilang di tampilan publik).
// `card` = dibungkus card sendiri (section "terpisah" di bawah), kalau tidak
// dia cuma blok di dalam kolom kanan.
export default function ProfileSection({ id, title, onAdd, onEdit, editable = true, card, addLabel, children }) {
  return (
    <section id={id} className={card ? "card fp-card" : "fp-section"}>
      <div className="fp-section-head">
        <h3 className="t-h3" style={{ fontSize: 16 }}>{title}</h3>
        {editable && (onAdd || onEdit) && (
          <div className="row gap-8">
            {onEdit && <IconBtn icon="pencil" label={`Edit ${title}`} onClick={onEdit} />}
            {onAdd && <IconBtn icon="plus" label={addLabel || `Tambah ${title}`} onClick={onAdd} />}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
