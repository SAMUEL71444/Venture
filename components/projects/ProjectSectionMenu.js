"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import Popover from "@/components/ui/Popover";
import { STATUS_META } from "@/lib/projects.mock";

const SECTIONS = [
  { id: "aktif", label: "Proyek Aktif", icon: "activity" },
  { id: "semua", label: "Semua Proyek", icon: "folder" },
  { id: "disimpan", label: "Proyek yang Disimpan", icon: "bookmark" },
];

// Tiga tombol section di atas daftar proyek. Tiap tombol punya popover
// ringkasan sendiri (hover ATAU klik — lihat components/ui/Popover.js),
// berisi jumlah + beberapa item terbaru + link "Lihat semua".
export default function ProjectSectionMenu({ activeTab, onSelectTab, dataByTab }) {
  return (
    <div className="row gap-10 mb-20" style={{ flexWrap: "wrap" }}>
      {SECTIONS.map((s) => {
        const items = dataByTab[s.id] || [];
        return (
          <Popover
            key={s.id}
            align="start"
            trigger={({ open, onClick }) => (
              <button
                type="button"
                className={`section-trigger ${activeTab === s.id ? "active" : ""}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => {
                  onSelectTab(s.id);
                  onClick();
                }}
              >
                <Icon name={s.icon} />
                <span>{s.label}</span>
                <span className="section-trigger-count">{items.length}</span>
                <Icon name="chevDown" className="section-trigger-caret" />
              </button>
            )}
          >
            {({ close }) => (
              <div className="popover-section">
                <div className="popover-section-head">
                  <span className="t-small" style={{ fontWeight: 700 }}>{s.label}</span>
                  <span className="t-caption">{items.length} proyek</span>
                </div>

                {items.length === 0 ? (
                  <p className="t-small muted" style={{ padding: "4px 16px 12px" }}>Belum ada proyek di sini.</p>
                ) : (
                  items.slice(0, 5).map((p) => {
                    const meta = STATUS_META[p.status];
                    return (
                      <div key={p.id} className="popover-item">
                        <span className={`popover-item-icon ${meta.badgeClass}`}>
                          <Icon name={meta.icon} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="t-small popover-item-title">{p.title}</div>
                          <div className="t-caption">{p.client}</div>
                        </div>
                      </div>
                    );
                  })
                )}

                <Link
                  href={`/projects?tab=${s.id}`}
                  className="popover-see-all"
                  onClick={() => {
                    onSelectTab(s.id);
                    close();
                  }}
                >
                  Lihat semua <Icon name="arrowRight" />
                </Link>
              </div>
            )}
          </Popover>
        );
      })}
    </div>
  );
}
