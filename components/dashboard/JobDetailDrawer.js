"use client";

import { useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import Icon from "@/components/Icon";
import JobDetailSkeleton from "./JobDetailSkeleton";

const FETCH_DELAY_MS = 600; // konsisten dengan delay simulasi di JobFeed

// Drawer generik dari komponen/ui/Drawer, dikombinasikan dengan konten
// spesifik "detail proyek". Setiap kali `project` berganti, kita simulasikan
// fetch ulang (skeleton dulu, baru konten) — nanti ini yang diganti query
// Supabase per-id begitu backend-nya ada.
export default function JobDetailDrawer({ project, open, onClose }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !project) return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), FETCH_DELAY_MS);
    return () => clearTimeout(t);
  }, [open, project?.id]);

  return (
    <Drawer open={open} onClose={onClose} title={loading ? "Memuat proyek..." : project?.title}>
      {!project ? null : loading ? (
        <JobDetailSkeleton />
      ) : (
        <div className="job-detail">
          <div className="row-between">
            <span className="badge badge-primary">{project.category}</span>
            <span className="t-caption">{project.applicants} pelamar</span>
          </div>

          <h3 className="t-h2 mt-16">{project.title}</h3>
          <div className="t-small muted mt-6">{project.umkm} · {project.location}</div>

          <div className="job-detail-stats mt-20">
            <div>
              <div className="t-caption">BUDGET</div>
              <div className="t-h3 mt-4" style={{ fontSize: 17 }}>{project.budget}</div>
            </div>
            <div>
              <div className="t-caption">TENGGAT</div>
              <div className="t-h3 mt-4" style={{ fontSize: 17 }}>{project.deadline}</div>
            </div>
          </div>

          <div className="divider" />

          <div>
            <div className="t-caption mb-8">DESKRIPSI PROYEK</div>
            <p className="t-body">{project.desc}</p>
          </div>

          {project.requirements?.length > 0 && (
            <div className="mt-20">
              <div className="t-caption mb-8">YANG DICARI UMKM INI</div>
              <ul className="job-detail-reqs">
                {project.requirements.map((r) => (
                  <li key={r}><Icon name="check" /> {r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="drawer-footer">
            {/* Belum ada backend lamaran/proposal — tombol ini dummy dulu,
                sama seperti pola di ApplicantRow. */}
            <button className="btn btn-primary btn-block btn-lg" onClick={() => alert("Fitur ajukan proposal belum tersedia di prototipe ini")}>
              Ajukan Proposal
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
