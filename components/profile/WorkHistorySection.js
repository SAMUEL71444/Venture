"use client";

import ProfileSection from "./ProfileSection";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { REVIEWS } from "@/lib/profile.mock";

function Stars({ n }) {
  return (
    <span className="fp-stars" aria-label={`${n} dari 5 bintang`}>
      {"★".repeat(n)}<span style={{ color: "var(--border-strong)" }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

// Riwayat Kerja: otomatis dari proyek berstatus "selesai" di Proyek Saya
// (`projects` sudah difilter pemanggil), ulasan dari REVIEWS. Tanpa tombol
// tambah — riwayat ini tercatat otomatis, bukan diisi manual.
export default function WorkHistorySection({ projects }) {
  return (
    <ProfileSection title="Riwayat Kerja">
      {projects.length === 0 ? (
        <p className="t-small muted mt-12">Belum ada riwayat kerja. Proyek yang selesai akan muncul di sini otomatis.</p>
      ) : (
        <div className="fp-list">
          {projects.map((p) => {
            const review = REVIEWS[p.id];
            return (
              <div key={p.id} className="fp-list-item" style={{ display: "block" }}>
                <div className="row-between" style={{ gap: 12, alignItems: "flex-start" }}>
                  <div className="t-small" style={{ fontWeight: 700 }}>{p.title}</div>
                  <span className="t-small" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatRupiah(p.budget)}</span>
                </div>
                <div className="t-caption">{p.client} · {formatTanggal(p.startDate)} – {formatTanggal(p.deadline)}</div>
                {review && (
                  <div className="mt-4">
                    <Stars n={review.rating} />
                    <p className="t-small muted mt-4">“{review.comment}”</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ProfileSection>
  );
}
