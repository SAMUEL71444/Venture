"use client";

import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { INVOICE_STATUS_META } from "@/lib/earnings";
import { formatRupiah, formatTanggal } from "@/lib/format";

export default function InvoiceDrawer({ invoice: inv, open, onClose, onDownload }) {
  const meta = inv ? INVOICE_STATUS_META[inv.status] : null;

  return (
    <Drawer open={open} onClose={onClose} title={inv?.number || "Faktur"}>
      {inv && (
        <div className="invoice-sheet">
          <div className="invoice-brand">
            <LogoMark size={30} />
            <Wordmark />
          </div>
          <div className="row-between">
            <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
            <span className="t-caption">{formatTanggal(inv.date)}</span>
          </div>

          <div className="mt-16">
            <div className="t-caption">DITAGIHKAN KE</div>
            <div className="t-h3 mt-4" style={{ fontSize: 16 }}>{inv.client}</div>
            <div className="t-small muted">{inv.projectTitle}</div>
          </div>

          <div className="divider" />

          <table className="simple-table">
            <thead>
              <tr><th>Termin</th><th style={{ textAlign: "right" }}>Nilai</th></tr>
            </thead>
            <tbody>
              {inv.items.map((it) => (
                <tr key={it.id}>
                  <td>Milestone {it.milestoneIndex}: {it.milestoneName}</td>
                  <td style={{ textAlign: "right" }}>{formatRupiah(it.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="fee-breakdown mt-16">
            <div className="fee-row"><span>Subtotal</span><span>{formatRupiah(inv.subtotal)}</span></div>
            <div className="fee-row muted"><span>Biaya platform (10%)</span><span>−{formatRupiah(inv.fee)}</span></div>
            <div className="fee-row total"><span>Total bersih</span><span>{formatRupiah(inv.net)}</span></div>
          </div>

          <div className="drawer-footer">
            <button type="button" className="btn btn-secondary btn-block btn-lg" onClick={onDownload}>
              <Icon name="download" /> Unduh PDF
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
