"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import { TX_STATUS_META } from "@/lib/earnings";
import { formatRupiah, formatTanggal } from "@/lib/format";

export default function TransactionDetailDrawer({ transaction: t, open, onClose }) {
  const meta = t ? TX_STATUS_META[t.status] : null;

  return (
    <Drawer open={open} onClose={onClose} title={t ? t.projectTitle : "Detail Transaksi"}>
      {t && (
        <div className="job-detail">
          <div className="row-between">
            <span className={`badge ${meta.badgeClass}`}><Icon name={meta.icon} /> {meta.label}</span>
            <span className="t-caption">{formatTanggal(t.date)}</span>
          </div>

          <h3 className="t-h2 mt-16">{t.projectTitle}</h3>
          <div className="t-small muted mt-6">
            Klien: {t.client} · Milestone {t.milestoneIndex}: {t.milestoneName}
          </div>

          {t.note && (
            <div className="card mt-16" style={{ background: "var(--bg)", padding: 14 }}>
              <span className="t-small">{t.note}</span>
            </div>
          )}

          <div className="divider" />

          <div>
            <div className="t-caption mb-8">RINCIAN PEMBAYARAN</div>
            <div className="fee-breakdown">
              <div className="fee-row"><span>Nilai termin ({Math.round(t.persen * 100)}%)</span><span>{formatRupiah(t.gross)}</span></div>
              <div className="fee-row muted"><span>Biaya platform (10%)</span><span>−{formatRupiah(t.fee)}</span></div>
              <div className="fee-row total"><span>Diterima bersih</span><span>{formatRupiah(t.net)}</span></div>
            </div>
          </div>

          <div className="mt-20">
            <div className="t-caption mb-4">METODE PEMBAYARAN</div>
            <div className="t-small">{t.metode}</div>
          </div>

          <div className="drawer-footer">
            <Link href={`/projects?tab=semua&q=${encodeURIComponent(t.projectTitle)}`} className="btn btn-secondary btn-block btn-lg">
              Lihat Proyek
            </Link>
          </div>
        </div>
      )}
    </Drawer>
  );
}
