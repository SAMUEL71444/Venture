"use client";

import ProfileSection from "./ProfileSection";
import { formatRupiah } from "@/lib/format";

// Katalog Proyek: paket jasa yang ditawarkan mahasiswa ke UMKM.
export default function CatalogSection({ id, catalog, editable, showToast }) {
  return (
    <ProfileSection id={id} title="Katalog Proyek" editable={false}>
      <p className="t-small muted mt-8">
        Paket jasa adalah cara baru dapat proyek: tawarkan layanan dengan harga dan durasi jelas, UMKM tinggal memesan.
      </p>
      <div className="fp-grid-cards mt-12">
        {catalog.map((c) => (
          <div key={c.id} className="card fp-mini-card">
            <div className="t-small" style={{ fontWeight: 700 }}>{c.title}</div>
            <div className="t-small mt-8" style={{ color: "var(--primary-dark)", fontWeight: 700 }}>{formatRupiah(c.price)}</div>
            <div className="t-caption">Estimasi {c.days} hari</div>
          </div>
        ))}
      </div>
      {editable && (
        <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={() => showToast("Pengelolaan katalog belum tersedia di prototipe ini.")}>
          Kelola Katalog
        </button>
      )}
    </ProfileSection>
  );
}
