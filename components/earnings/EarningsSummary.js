"use client";

import Icon from "@/components/Icon";
import { formatRupiah } from "@/lib/format";

const CARDS = [
  { key: "totalPenghasilan", label: "Total Penghasilan", icon: "trendingUp", hint: "Dari proyek selesai & sedang dicairkan" },
  { key: "saldoTersedia", label: "Saldo Bisa Ditarik", icon: "wallet", hint: "Bisa ditarik kapan saja" },
  { key: "saldoTertahan", label: "Dana Tertahan (Escrow)", icon: "lock", hint: "Menunggu milestone disetujui klien", tooltip: "Dana ini akan cair otomatis setelah klien menyetujui hasil kerja." },
  { key: "totalDitarik", label: "Total Ditarik", icon: "arrowDownLeft", hint: "Penarikan yang sudah berhasil" },
];

export default function EarningsSummary({ summary, onWithdraw }) {
  return (
    <div className="grid grid-4 mb-20">
      {CARDS.map((c) => (
        <div key={c.key} className="card card-pad earn-card" data-tooltip={c.tooltip}>
          <div className="earn-card-icon"><Icon name={c.icon} /></div>
          <div className="t-caption mt-12">{c.label.toUpperCase()}</div>
          <div className="earn-card-value">{formatRupiah(summary[c.key])}</div>
          <div className="t-caption earn-card-hint">{c.hint}</div>
          {c.key === "saldoTersedia" && (
            <button type="button" className="btn btn-primary btn-sm mt-12" onClick={onWithdraw}>
              <Icon name="arrowUpRight" /> Tarik Dana
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
