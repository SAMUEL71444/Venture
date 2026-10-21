"use client";

import Icon from "@/components/Icon";
import { formatRupiah } from "@/lib/format";

const CARDS = [
  { key: "totalPengeluaran", label: "Total Pengeluaran", icon: "arrowUpRight", hint: "Sudah & sedang dicairkan ke mahasiswa" },
  { key: "danaTertahan", label: "Dana Tertahan di Escrow", icon: "lock", hint: "Menunggu persetujuan milestone", tooltip: "Dana aman di escrow dan baru cair setelah kamu menyetujui hasil kerja." },
  { key: "saldoDeposit", label: "Saldo Deposit Tersedia", icon: "wallet", hint: "Bisa dipakai mendanai proyek baru" },
  { key: "proyekLunas", label: "Proyek Dibayar Lunas", icon: "checkCircle", hint: "Proyek selesai, semua termin cair", isCount: true },
  { key: "rataRataPerProyek", label: "Rata-rata per Proyek", icon: "activity", hint: "Patokan budget proyek berikutnya" },
];

// Pola kartu .earn-card yang sama dengan EarningsSummary (Penghasilan),
// tapi framing-nya pengeluaran UMKM.
export default function PaymentsSummary({ summary, onTopUp }) {
  return (
    <div className="grid grid-5 mb-20">
      {CARDS.map((c) => (
        <div key={c.key} className="card card-pad earn-card" data-tooltip={c.tooltip}>
          <div className="earn-card-icon pay-card-icon"><Icon name={c.icon} /></div>
          <div className="t-caption mt-12">{c.label.toUpperCase()}</div>
          <div className="earn-card-value">{c.isCount ? summary[c.key] : formatRupiah(summary[c.key])}</div>
          <div className="t-caption earn-card-hint">{c.hint}</div>
          {c.key === "saldoDeposit" && (
            <button type="button" className="btn btn-secondary btn-sm mt-12" onClick={onTopUp}>
              <Icon name="plus" /> Top Up
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
