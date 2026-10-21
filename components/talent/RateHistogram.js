"use client";

import { formatRupiahShort } from "@/lib/format";

const BUCKETS = 8;

// Distribusi tarif per jam (bar) + dua slider untuk batas bawah/atas.
// Bar di luar rentang terpilih dipudarkan, seperti filter Hourly rate Upwork.
export default function RateHistogram({ rates, min, max, value, onChange }) {
  const [lo, hi] = value;
  const step = (max - min) / BUCKETS;
  const counts = Array.from({ length: BUCKETS }, (_, i) => {
    const a = min + i * step;
    const b = i === BUCKETS - 1 ? max + 1 : a + step;
    return rates.filter((r) => r >= a && r < b).length;
  });
  const peak = Math.max(1, ...counts);

  return (
    <div>
      <div className="ft-hist" aria-hidden="true">
        {counts.map((c, i) => {
          const a = min + i * step;
          const inRange = a + step > lo && a <= hi;
          return (
            <div
              key={i}
              className={`ft-hist-bar ${inRange ? "" : "dim"}`}
              style={{ height: `${Math.max(6, (c / peak) * 100)}%` }}
            />
          );
        })}
      </div>
      <div className="ft-range">
        <input
          type="range" min={min} max={max} step={5000} value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          aria-label="Tarif minimum"
        />
        <input
          type="range" min={min} max={max} step={5000} value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
          aria-label="Tarif maksimum"
        />
      </div>
      <div className="row-between t-caption mt-8">
        <span>{formatRupiahShort(lo)}</span>
        <span>{formatRupiahShort(hi)}{hi >= max ? "+" : ""}</span>
      </div>
    </div>
  );
}
