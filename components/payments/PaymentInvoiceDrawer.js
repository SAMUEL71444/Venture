"use client";

import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { INVOICE_STATUS_META } from "@/lib/earnings";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { UMKM_SERVICE_FEE } from "@/lib/payments.mock";

// Faktur dari sisi UMKM (pola InvoiceDrawer Penghasilan, kelas yang sama),
// tapi totalnya = nilai termin + biaya layanan, bukan potongan.
export default function PaymentInvoiceDrawer({ invoice: inv, open, onClose, onDownload }) {
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

          <div className="grid grid-2 mt-16" style={{ gap: 12 }}>
            <div>
              <div className="t-caption">DARI</div>
              <div className="t-small mt-4" style={{ fontWeight: 700 }}>{inv.client}</div>
            </div>
            <div>
              <div className="t-caption">KEPADA</div>
              <div className="t-small mt-4" style={{ fontWeight: 700 }}>{inv.freelancerName}</div>
            </div>
          </div>
          <div className="t-small muted mt-8">{inv.projectTitle}</div>

          <div className="divider" />

          <table className="simple-table">
            <thead>
              <tr><th>Termin</th><th style={{ textAlign: "right" }}>Nilai</th></tr>
            </thead>
            <tbody>
              {inv.items.map((it) => (
                <tr key={it.id}>
                  <td>Milestone {it.milestoneIndex}: {it.milestoneName}</td>
                  <td style={{ textAlign: "right" }}>{formatRupiah(it.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="fee-breakdown mt-16">
            <div className="fee-row"><span>Subtotal</span><span>{formatRupiah(inv.subtotal)}</span></div>
            <div className="fee-row muted"><span>Biaya layanan ({Math.round(UMKM_SERVICE_FEE * 100)}%)</span><span>+{formatRupiah(inv.fee)}</span></div>
            <div className="fee-row total"><span>Total dibayar</span><span>{formatRupiah(inv.total)}</span></div>
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
