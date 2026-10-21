"use client";

import Link from "next/link";
import Drawer from "@/components/ui/Drawer";
import FundStatusBadge from "@/components/escrow/FundStatusBadge";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { UMKM_SERVICE_FEE } from "@/lib/payments.mock";

// Rincian satu termin dari sisi UMKM. Nilai termin & status dana di sini
// sama persis dengan yang dilihat mahasiswa (Penghasilan) dan Verify &
// Trust (Transaksi & Dana); bedanya cuma biaya layanan UMKM di atasnya.
export default function PaymentDetailDrawer({ payment: p, open, onClose }) {
  return (
    <Drawer open={open} onClose={onClose} title={p ? p.projectTitle : "Detail Pembayaran"}>
      {p && (
        <div className="job-detail">
          <div className="row-between">
            <FundStatusBadge status={p.status} />
            <span className="t-caption">{formatTanggal(p.date)}</span>
          </div>

          <h3 className="t-h2 mt-16">{p.projectTitle}</h3>
          <div className="t-small muted mt-6">
            Mahasiswa: {p.freelancerName} · Milestone {p.milestoneIndex}: {p.milestoneName}
          </div>

          {p.note && (
            <div className="card mt-16" style={{ background: "var(--bg)", padding: 14 }}>
              <span className="t-small">{p.note}</span>
            </div>
          )}

          <div className="divider" />

          <div className="grid grid-2" style={{ gap: 12 }}>
            <div>
              <div className="t-caption mb-4">TANGGAL DIBAYAR</div>
              <div className="t-small">{formatTanggal(p.date)}</div>
            </div>
            <div>
              <div className="t-caption mb-4">METODE PEMBAYARAN</div>
              <div className="t-small">{p.methodLabel}</div>
            </div>
          </div>

          <div className="mt-20">
            <div className="t-caption mb-8">RINCIAN PEMBAYARAN</div>
            <div className="fee-breakdown">
              <div className="fee-row"><span>Nilai termin ({Math.round(p.persen * 100)}% proyek)</span><span>{formatRupiah(p.amount)}</span></div>
              <div className="fee-row muted"><span>Biaya layanan ({Math.round(UMKM_SERVICE_FEE * 100)}%)</span><span>+{formatRupiah(p.fee)}</span></div>
              <div className="fee-row total">
                <span>{p.status === "dikembalikan" ? "Dikembalikan ke kamu" : "Total dibayarkan"}</span>
                <span className={p.status === "dikembalikan" ? "" : "pay-amount-out"}>{formatRupiah(p.totalPaid)}</span>
              </div>
            </div>
          </div>

          <div className="drawer-footer">
            <Link href={`/projects?project=${p.projectId}`} className="btn btn-secondary btn-block btn-lg">
              Lihat Proyek
            </Link>
          </div>
        </div>
      )}
    </Drawer>
  );
}
