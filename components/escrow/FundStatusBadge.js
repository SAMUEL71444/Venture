import Icon from "@/components/Icon";
import { FUND_STATUS } from "@/lib/escrow";

// Badge status dana yang SAMA dipakai di Penghasilan (Nadia), Proyek Saya
// (UMKM), dan Transaksi & Dana (Verify & Trust) — ikon + label, bukan cuma
// warna, biar tetap jelas buat yang buta warna. `lockedLabel` dipakai UMKM
// buat status "ditahan" (lihat plan: "Ditahan Sistem" + ikon gembok).
export default function FundStatusBadge({ status, lockedLabel, tooltip }) {
  const meta = FUND_STATUS[status];
  if (!meta) return null;
  const label = status === "ditahan" && lockedLabel ? lockedLabel : meta.label;

  return (
    <span className={`badge ${meta.badgeClass}`} data-tooltip={tooltip}>
      <Icon name={meta.icon} /> {label}
    </span>
  );
}
