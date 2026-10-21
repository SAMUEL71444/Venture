"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/format";

function shortRupiah(n) {
  if (n >= 1000000) return `Rp${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1).replace(".", ",")}jt`;
  if (n >= 1000) return `Rp${Math.round(n / 1000)}rb`;
  return "Rp0";
}

// Bar chart 1 seri (satu hue, --primary — sudah divalidasi lewat skill
// dataviz) buat penghasilan 6 bulan terakhir. Tooltip muncul di hover ATAU
// fokus keyboard; ada tabel tersembunyi (.sr-only) sebagai alternatif teks.
// `title`/`subtitle`/`tone` opsional — dipakai halaman Pembayaran UMKM
// (tone "spend" = bar oranye, lihat .income-chart-card.spend di
// globals.css). Tanpa prop itu tampilannya persis seperti Penghasilan.
export default function IncomeChart({
  months,
  title = "Penghasilan 6 Bulan Terakhir",
  subtitle = "Dari proyek selesai & sedang dicairkan — saldo tertahan tidak dihitung",
  tone,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const max = Math.max(...months.map((m) => m.total), 1);

  return (
    <div className={`card card-pad income-chart-card mb-20 ${tone || ""}`.trim()}>
      <div className="t-h3" style={{ fontSize: 16 }}>{title}</div>
      <div className="t-caption mt-4">{subtitle}</div>

      <div className="income-chart mt-20">
        {months.map((m, i) => {
          const h = m.total === 0 ? 3 : Math.max(8, Math.round((m.total / max) * 140));
          const active = hoverIdx === i;
          return (
            <div
              key={m.key}
              className="income-bar-col"
              tabIndex={0}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((v) => (v === i ? null : v))}
              onFocus={() => setHoverIdx(i)}
              onBlur={() => setHoverIdx((v) => (v === i ? null : v))}
            >
              {active && <div className="income-tooltip">{formatRupiah(m.total)}</div>}
              <div className="income-bar-track">
                <div className={`income-bar ${active ? "active" : ""}`} style={{ height: h }} />
              </div>
              <div className="income-bar-value">{m.total > 0 ? shortRupiah(m.total) : "–"}</div>
              <div className="income-bar-label">{m.label}</div>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>{tone ? title : "Penghasilan bulanan, 6 bulan terakhir"}</caption>
        <thead><tr><th>Bulan</th><th>Total</th></tr></thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}><td>{m.label}</td><td>{formatRupiah(m.total)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
