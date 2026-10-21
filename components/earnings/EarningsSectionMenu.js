"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import Popover from "@/components/ui/Popover";
import { TX_STATUS_META, WD_STATUS_META } from "@/lib/earnings";
import { formatRupiah, formatTanggal } from "@/lib/format";

const SECTIONS = [
  {
    id: "transaksi", label: "Riwayat Transaksi", icon: "fileText",
    preview: (t) => ({
      icon: TX_STATUS_META[t.status].icon,
      badgeClass: TX_STATUS_META[t.status].badgeClass,
      title: t.projectTitle,
      subtitle: `Milestone ${t.milestoneIndex} · ${formatTanggal(t.date)}`,
    }),
  },
  {
    id: "penarikan", label: "Penarikan Dana", icon: "landmark",
    preview: (w) => ({
      icon: WD_STATUS_META[w.status].icon,
      badgeClass: WD_STATUS_META[w.status].badgeClass,
      title: formatRupiah(w.amount),
      subtitle: `${w.accountLabel} · ${formatTanggal(w.date)}`,
    }),
  },
  {
    id: "faktur", label: "Faktur", icon: "fileText",
    preview: (i) => ({
      icon: "fileText",
      badgeClass: "badge-neutral",
      title: i.number,
      subtitle: i.projectTitle,
    }),
  },
];

// Tiga tombol section di atas daftar Penghasilan — pola identik dengan
// ProjectSectionMenu di halaman Proyek Saya (popover generik yang sama).
// `sections`/`basePath` opsional: halaman Pembayaran UMKM memakai komponen
// yang sama dengan daftar section & URL miliknya sendiri.
export default function EarningsSectionMenu({ activeTab, onSelectTab, dataByTab, sections = SECTIONS, basePath = "/earnings" }) {
  return (
    <div className="row gap-10 mb-20" style={{ flexWrap: "wrap" }}>
      {sections.map((s) => {
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
                onClick={() => { onSelectTab(s.id); onClick(); }}
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
                  <span className="t-caption">{items.length} item</span>
                </div>

                {items.length === 0 ? (
                  <p className="t-small muted" style={{ padding: "4px 16px 12px" }}>Belum ada data di sini.</p>
                ) : (
                  items.slice(0, 5).map((item) => {
                    const v = s.preview(item);
                    return (
                      <div key={item.id} className="popover-item">
                        <span className={`popover-item-icon ${v.badgeClass}`}>
                          <Icon name={v.icon} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div className="t-small popover-item-title">{v.title}</div>
                          <div className="t-caption">{v.subtitle}</div>
                        </div>
                      </div>
                    );
                  })
                )}

                <Link
                  href={`${basePath}?tab=${s.id}`}
                  className="popover-see-all"
                  onClick={() => { onSelectTab(s.id); close(); }}
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
