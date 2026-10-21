"use client";

import Icon from "@/components/Icon";
import { TX_STATUS_META, WD_STATUS_META, INVOICE_STATUS_META } from "@/lib/earnings";
import { formatRupiah, formatTanggal } from "@/lib/format";

// Satu baris di dalam .job-feed-list (kelas yang sama dengan Proyek Saya),
// dengan tiga varian isi: transaksi, penarikan, atau faktur.
export default function LedgerRow({ variant, item, onClick }) {
  if (variant === "transaksi") {
    const meta = TX_STATUS_META[item.status];
    return (
      <div className="job-item ledger-row" onClick={() => onClick(item)}>
        <div className="ledger-row-main">
          <div className="row-between mb-8">
            <span className={`badge ${meta.badgeClass}`}><Icon name={meta.icon} /> {meta.label}</span>
            <span className="t-caption">{formatTanggal(item.date)}</span>
          </div>
          <div className="job-item-title" style={{ fontSize: 17 }}>{item.projectTitle}</div>
          <div className="t-small muted mt-4">
            {item.client} · Milestone {item.milestoneIndex}: {item.milestoneName} · {item.metode}
          </div>
          {item.note && <p className="t-caption mt-8">{item.note}</p>}
        </div>
        <div className="ledger-row-amount">
          <div className="t-caption">DITERIMA BERSIH</div>
          <div className="ledger-amount-value">{formatRupiah(item.net)}</div>
        </div>
      </div>
    );
  }

  if (variant === "penarikan") {
    const meta = WD_STATUS_META[item.status];
    return (
      <div className="job-item ledger-row" onClick={() => onClick(item)}>
        <div className="ledger-row-main">
          <div className="row-between mb-8">
            <span className={`badge ${meta.badgeClass}`}><Icon name={meta.icon} /> {meta.label}</span>
            <span className="t-caption">{formatTanggal(item.date)}</span>
          </div>
          <div className="job-item-title" style={{ fontSize: 17 }}>{formatRupiah(item.amount)}</div>
          <div className="t-small muted mt-4">{item.accountLabel}</div>
          {item.note && <p className="t-caption mt-8">{item.note}</p>}
        </div>
        <span className="job-row-arrow"><Icon name="chevRight" /></span>
      </div>
    );
  }

  const meta = INVOICE_STATUS_META[item.status];
  return (
    <div className="job-item ledger-row" onClick={() => onClick(item)}>
      <div className="ledger-row-main">
        <div className="row-between mb-8">
          <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
          <span className="t-caption">{formatTanggal(item.date)}</span>
        </div>
        <div className="job-item-title" style={{ fontSize: 17 }}>{item.number}</div>
        <div className="t-small muted mt-4">{item.projectTitle} · {item.client}</div>
      </div>
      <div className="ledger-row-amount">
        <div className="t-caption">TOTAL BERSIH</div>
        <div className="ledger-amount-value">{formatRupiah(item.net)}</div>
      </div>
    </div>
  );
}
