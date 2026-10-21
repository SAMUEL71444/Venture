import { getAllProjects } from "@/lib/projects.mock";

const SIZE = 104;
const STROKE = 11;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

// Donut satu nilai (selesai / total), bukan grafik kategorikal — makanya
// cuma satu warna (--success, sudah divalidasi lewat skill dataviz) dipakai
// buat busurnya. Aktif/Dibatalkan ditampilkan sebagai teks pendukung biasa,
// SENGAJA tanpa titik warna, supaya nggak kelihatan seperti donut 3 segmen
// padahal yang digambar cuma satu rasio.
export default function CompletionSummary() {
  const projects = getAllProjects();
  const selesai = projects.filter((p) => p.status === "selesai").length;
  const aktif = projects.filter((p) => ["berjalan", "menunggu_review", "revisi"].includes(p.status)).length;
  const dibatalkan = projects.filter((p) => p.status === "dibatalkan").length;
  const total = selesai + aktif + dibatalkan;
  const pct = total ? Math.round((selesai / total) * 100) : 0;
  const offset = CIRC - (pct / 100) * CIRC;

  return (
    <div className="card card-pad completion-card mb-20">
      <div className="completion-donut">
        <svg
          width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img" aria-label={`${selesai} dari ${total} proyek selesai, ${pct} persen`}
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--bg)" strokeWidth={STROKE} />
          {pct > 0 && (
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--success)" strokeWidth={STROKE}
              strokeDasharray={CIRC} strokeDashoffset={offset} strokeLinecap="round"
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          )}
        </svg>
        <div className="completion-donut-pct">{pct}%</div>
      </div>

      <div className="completion-info">
        <div className="t-h3" style={{ fontSize: 16 }}>{selesai} dari {total} proyek selesai</div>
        <p className="t-caption mt-4">Aktif {aktif} · Dibatalkan {dibatalkan}</p>
      </div>
    </div>
  );
}
