"use client";

import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import ProjectFundList from "@/components/escrow/ProjectFundList";
import MilestoneManager from "@/components/projects/MilestoneManager";
import { STATUS_META } from "@/lib/projects.mock";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { useChat } from "@/context/ChatContext";

// `perspective="client"` (sudut pandang UMKM) nambahin daftar "Dana per
// milestone" dan ubah label tombol pesan jadi ke freelancer, bukan klien.
export default function ProjectDetailDrawer({ project, open, onClose, perspective = "freelancer" }) {
  const { openWidget } = useChat();
  const meta = project ? STATUS_META[project.status] : null;
  const isClientView = perspective === "client";

  return (
    <Drawer open={open} onClose={onClose} title={project?.title || "Detail Proyek"}>
      {project && (
        <div className="job-detail">
          <div className="row-between">
            <span className={`badge ${meta.badgeClass}`}>
              <Icon name={meta.icon} /> {meta.label}
            </span>
            <span className="t-caption">Klien: {project.client}</span>
          </div>

          <div className="job-detail-stats mt-20">
            <div>
              <div className="t-caption">ANGGARAN</div>
              <div className="t-h3 mt-4" style={{ fontSize: 17 }}>{formatRupiah(project.budget)}</div>
            </div>
            <div>
              <div className="t-caption">TENGGAT</div>
              <div className="t-h3 mt-4" style={{ fontSize: 17 }}>{formatTanggal(project.deadline)}</div>
            </div>
          </div>

          {project.status !== "terbuka" && (
            <div className="mt-20">
              <div className="row-between t-caption mb-4"><span>Progress</span><span>{project.progress}%</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${project.progress}%` }} /></div>
            </div>
          )}

          <div className="divider" />

          <div>
            <div className="t-caption mb-8">DESKRIPSI</div>
            <p className="t-body">{project.description}</p>
          </div>

          {isClientView && <MilestoneManager project={project} />}

          {isClientView && <ProjectFundList project={project} />}

          <div className="drawer-footer">
            {isClientView && !project.freelancerName ? (
              <p className="t-small muted" style={{ textAlign: "center" }}>
                Belum ada freelancer di proyek ini. Pesan tersedia setelah ada freelancer yang mengerjakannya.
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block btn-lg"
                onClick={() => { onClose(); openWidget(project.id); }}
              >
                <Icon name="chat" /> {isClientView ? "Kirim Pesan ke Freelancer" : "Kirim Pesan ke Klien"}
              </button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
