import FundStatusBadge from "./FundStatusBadge";
import { termsForProject, fundStatusOfTerm } from "@/lib/escrow";
import { activeReportProjectIds } from "@/lib/reports.mock";
import { formatRupiah } from "@/lib/format";
import { MOCK_TODAY } from "@/lib/projects.mock";

// Daftar "Dana per milestone" di drawer detail proyek — dilihat dari sisi
// UMKM (lihat plan bagian 6). Status dihitung fundStatusOfTerm(), SAMA
// persis dengan yang dipakai Penghasilan (Nadia) dan /escrow (Verify &
// Trust), jadi nggak pernah beda-beda tiap dilihat dari sisi mana.
export default function ProjectFundList({ project }) {
  const terms = termsForProject(project.id);
  if (terms.length === 0) return null;
  const frozenProjectIds = activeReportProjectIds();

  return (
    <div className="mt-20">
      <div className="t-caption mb-8">DANA PER MILESTONE</div>
      <div className="fund-list">
        {terms.map((t) => {
          const idx = project.milestones.findIndex((m) => m.id === t.milestoneId);
          const milestone = project.milestones[idx];
          const status = fundStatusOfTerm(t, project, MOCK_TODAY, { frozenProjectIds });
          const amount = Math.round(project.budget * t.persen);
          return (
            <div key={t.milestoneId} className="fund-row row-between">
              <span className="t-small">Milestone {idx + 1}: {milestone?.name}</span>
              <span className="row gap-8">
                <span className="t-small" style={{ fontWeight: 700 }}>{formatRupiah(amount)}</span>
                <FundStatusBadge
                  status={status}
                  lockedLabel="Ditahan Sistem"
                  tooltip={status === "ditahan" ? "Dana kamu aman, baru cair ke mahasiswa setelah kamu approve hasil kerja." : undefined}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
