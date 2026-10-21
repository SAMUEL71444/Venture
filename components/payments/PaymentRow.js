"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import FundStatusBadge from "@/components/escrow/FundStatusBadge";
import { INVOICE_STATUS_META } from "@/lib/earnings";
import { formatRupiah, formatTanggal } from "@/lib/format";

// Satu baris di .job-feed-list (kelas .ledger-row yang sama dengan
// Penghasilan). Nominal pengeluaran selalu ditulis "↑ −Rp…" supaya jelas
// ini uang keluar; termin yang dikembalikan ditulis "↩ +Rp…".
function Amount({ payment: p, label = "DIBAYARKAN" }) {
  const refunded = p.status === "dikembalikan";
  return (
    <div className="ledger-row-amount">
      <div className="t-caption">{refunded ? "DIKEMBALIKAN" : label}</div>
      <div className={`ledger-amount-value ${refunded ? "pay-amount-refund" : "pay-amount-out"}`}>
        {refunded ? "↩ +" : "↑ −"}{formatRupiah(p.totalPaid)}
      </div>
    </div>
  );
}

export default function PaymentRow({ variant, item, onClick }) {
  if (variant === "faktur") {
    const meta = INVOICE_STATUS_META[item.status];
    return (
      <div className="job-item ledger-row" onClick={() => onClick(item)}>
        <div className="ledger-row-main">
          <div className="row-between mb-8">
            <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
            <span className="t-caption">{formatTanggal(item.date)}</span>
          </div>
          <div className="job-item-title" style={{ fontSize: 17 }}>{item.number}</div>
          <div className="t-small muted mt-4">{item.projectTitle} · {item.freelancerName}</div>
        </div>
        <div className="ledger-row-amount">
          <div className="t-caption">TOTAL DIBAYAR</div>
          <div className="ledger-amount-value pay-amount-out">↑ −{formatRupiah(item.total)}</div>
        </div>
      </div>
    );
  }

  const p = item;
  return (
    <div className="job-item ledger-row" onClick={() => onClick(p)}>
      <div className="ledger-row-main">
        <div className="row-between mb-8">
          <FundStatusBadge status={p.status} />
          <span className="t-caption">{formatTanggal(p.date)}</span>
        </div>
        <div className="job-item-title" style={{ fontSize: 17 }}>{p.projectTitle}</div>
        <div className="t-small muted mt-4">
          {p.freelancerName} · Milestone {p.milestoneIndex}: {p.milestoneName} · {p.methodLabel}
        </div>
        {p.note && <p className="t-caption mt-8">{p.note}</p>}

        {variant === "tertahan" && (
          <div className="row gap-8 mt-12" style={{ flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
            {p.status === "dibekukan" ? (
              <span className="t-caption row gap-6"><Icon name="shield" /> Persetujuan dikunci sampai laporan selesai ditinjau.</span>
            ) : (
              <Link href={`/projects?project=${p.projectId}`} className={`btn btn-sm ${p.needsReview ? "btn-primary" : "btn-secondary"}`}>
                <Icon name="checkCircle" /> Tinjau & Setujui
              </Link>
            )}
          </div>
        )}
      </div>
      <Amount payment={p} label={variant === "tertahan" ? "DITAHAN" : "DIBAYARKAN"} />
    </div>
  );
}
