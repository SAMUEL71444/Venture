"use client";

import { useState } from "react";
import ProfileSection from "./ProfileSection";

function FolderIllustration() {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true">
      <path d="M14 30a8 8 0 0 1 8-8h22l8 9h46a8 8 0 0 1 8 8v37a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8V30Z" fill="var(--primary-tint)" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 42h92" stroke="var(--primary)" strokeWidth="2.5" />
      <rect x="50" y="54" width="20" height="8" rx="3" fill="var(--primary-light)" stroke="var(--primary)" strokeWidth="2" />
    </svg>
  );
}

// Portofolio: tab Dipublikasikan / Draft. `+` menambah item dummy ke draft
// (belum ada upload sungguhan — prototipe).
export default function PortfolioSection({ id, portfolio, onChange, editable }) {
  const [tab, setTab] = useState("published");
  const items = tab === "published" ? portfolio.published : portfolio.drafts;
  const shownTabs = editable ? ["published", "drafts"] : ["published"];

  function add() {
    const n = portfolio.drafts.length + 1;
    onChange({
      ...portfolio,
      drafts: [{ id: `pf-new-${Date.now()}`, title: `Proyek Baru ${n}`, category: "Draft", note: "Draft baru — lengkapi deskripsi dan gambar", fresh: true }, ...portfolio.drafts],
    }, "Proyek ditambahkan ke Draft.");
    setTab("drafts");
  }

  function publish(item) {
    onChange({
      published: [{ ...item, fresh: true, note: "Dipublikasikan" }, ...portfolio.published],
      drafts: portfolio.drafts.filter((d) => d.id !== item.id),
    }, "Proyek dipublikasikan.");
  }

  return (
    <ProfileSection id={id} title="Portofolio" editable={editable} onAdd={add} addLabel="Tambah proyek portofolio">
      <div className="tabs mt-12" style={{ marginBottom: 12 }}>
        {shownTabs.map((t) => (
          <button key={t} type="button" className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "published" ? "Dipublikasikan" : "Draft"}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: "16px 12px" }}>
          <FolderIllustration />
          <p className="t-small muted mt-8">
            {tab === "published"
              ? <>Tambahkan proyek. Freelancer dengan portofolio terpublikasi lebih sering dipilih UMKM.</>
              : "Belum ada draft."}
          </p>
          {editable && <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={add}>Tambah Proyek</button>}
        </div>
      ) : (
        <div className="fp-grid-cards">
          {items.map((p) => (
            <div key={p.id} className={`card fp-mini-card ${p.fresh ? "fp-fresh" : ""}`}>
              <div className="t-small" style={{ fontWeight: 700 }}>{p.title}</div>
              <div className="t-caption mt-4">{p.category}</div>
              <p className="t-caption mt-8">{p.note}</p>
              {editable && tab === "drafts" && (
                <button type="button" className="link-btn mt-8" onClick={() => publish(p)}>Publikasikan</button>
              )}
            </div>
          ))}
        </div>
      )}
    </ProfileSection>
  );
}
