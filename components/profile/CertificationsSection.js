"use client";

import ExperienceListSection from "./ExperienceListSection";

// Ilustrasi SVG inline buatan sendiri (warna dari design token), pola yang
// sama dengan components/projects/ProjectsEmptyState.js.
function TrophyIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
      <path d="M30 18h36v24a18 18 0 0 1-36 0V18Z" fill="var(--primary-light)" stroke="var(--primary)" strokeWidth="2.5" />
      <path d="M30 24H18c0 12 5 18 14 19M66 24h12c0 12-5 18-14 19" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M48 60v12M36 78h24" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
      <path d="m48 26 3 6 6.5 1-4.7 4.5 1.1 6.5L48 41l-5.9 3 1.1-6.5L38.5 33l6.5-1 3-6Z" fill="var(--primary)" />
    </svg>
  );
}

export default function CertificationsSection({ id, items, onChange, editable }) {
  const empty = (
    <div className="empty-state" style={{ padding: "24px 12px 8px" }}>
      <TrophyIllustration />
      <p className="t-small muted mt-8" style={{ maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
        Sertifikasi membantu UMKM percaya pada keahlianmu dan bisa meningkatkan peluang terpilih.
      </p>
    </div>
  );

  return (
    <ExperienceListSection
      id={id} title="Sertifikasi" items={items} onChange={onChange} editable={editable}
      emptyNode={empty} addLabel="Tambah sertifikasi"
      labels={{ title: "Nama sertifikasi", org: "Penerbit", period: "Tahun", desc: "Deskripsi (opsional)" }}
    />
  );
}
