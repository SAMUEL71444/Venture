"use client";

import { useState } from "react";
import JobDetailDrawer from "@/components/dashboard/JobDetailDrawer";
import { PROJECTS } from "@/lib/mock-data";

// Kategori yang cocok sama keahlian Nadia (Graphic Designer) — lihat
// CURRENT_USERS.mahasiswa di lib/users.mock.js. Kebetulan pas 4 lowongan.
const RECOMMENDED_IDS = ["p1", "p2", "p4", "p6"];

// Dipakai di empty state Proyek Saya — "Lihat Detail" & "Ajukan Lamaran"
// sama-sama buka JobDetailDrawer yang sudah ada (tombol "Ajukan Proposal"
// di dalamnya memang masih dummy, konsisten sama pola di seluruh app ini).
export default function RecommendedJobs() {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const jobs = PROJECTS.filter((p) => RECOMMENDED_IDS.includes(p.id));

  function openJob(job) {
    setSelected(job);
    setOpen(true);
  }

  return (
    <div className="mt-32">
      <h3 className="t-h3 mb-16">Rekomendasi untukmu</h3>
      <div className="reco-grid">
        {jobs.map((job) => (
          <div key={job.id} className="card card-pad reco-card">
            <span className="badge badge-primary">{job.category}</span>
            <div className="t-h3 mt-10" style={{ fontSize: 15 }}>{job.title}</div>
            <div className="t-small muted mt-4">{job.umkm}</div>
            <div className="row-between mt-12">
              <span className="t-small" style={{ fontWeight: 700 }}>{job.budget}</span>
              <span className="t-caption">Tenggat {job.deadline}</span>
            </div>
            <div className="row gap-8 mt-16">
              <button type="button" className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openJob(job)}>
                Lihat Detail
              </button>
              <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => openJob(job)}>
                Ajukan Lamaran
              </button>
            </div>
          </div>
        ))}
      </div>

      <JobDetailDrawer project={selected} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
