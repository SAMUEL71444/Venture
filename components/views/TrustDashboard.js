"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import usePolling from "@/components/admin/usePolling";
import { adminApi } from "@/lib/admin/api";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { useRole } from "@/context/RoleContext";

const DISPUTE_STATUS = {
  OPEN: { label: "Baru", badge: "badge-warning" },
  FOLLOWED_UP: { label: "Ditindaklanjuti", badge: "badge-info" },
  AWAITING_DECISION: { label: "Menunggu keputusan", badge: "badge-warning" },
  RESOLVED: { label: "Selesai", badge: "badge-success" },
};
const date = (iso) => (iso ? formatTanggal(iso.slice(0, 10)) : "—");

// Dashboard Verify & Trust: 3 kartu angka (verifikasi pending, dana tertahan,
// sengketa aktif) + daftar pendek terbaru, dari GET /admin/dashboard/summary.
// Diperbarui tiap 30 detik selama tab terlihat.
export default function TrustDashboard() {
  const { authUser, user } = useRole();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const res = await adminApi.dashboardSummary();
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setError(null);
    setData(res.data);
  }, []);

  usePolling(load, 30000);

  const number = (value) => (data ? value : "…");

  return (
    <>
      <h1 className="t-h1 mb-4">Halo, {authUser?.name || user.name} 👋</h1>
      <p className="t-body muted mb-20">Ringkasan verifikasi, dana escrow, dan laporan yang perlu ditindaklanjuti.</p>

      {error && <div className="card card-pad mb-16" role="alert" style={{ color: "var(--error)" }}>{error}</div>}

      <div className="grid grid-3 mb-20">
        <div className="card card-pad">
          <div className="t-caption">VERIFIKASI PENDING</div>
          <div className="t-h1 mt-8">{number(data?.pending_verifications)}</div>
          <Link href="/verifications" className="link-btn mt-8" style={{ display: "inline-block" }}>Tinjau sekarang</Link>
        </div>
        <div className="card card-pad">
          <div className="t-caption">DANA TERTAHAN</div>
          <div className="t-h1 mt-8">{data ? formatRupiah(data.held_funds.amount) : "…"}</div>
          <Link href="/escrow" className="link-btn mt-8" style={{ display: "inline-block" }}>{number(data?.held_funds.contracts)} kontrak</Link>
        </div>
        <div className="card card-pad">
          <div className="t-caption">SENGKETA AKTIF</div>
          <div className="t-h1 mt-8">{number(data?.active_disputes)}</div>
          <Link href="/reports" className="link-btn mt-8" style={{ display: "inline-block" }}>Lihat semua</Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <div className="section-title"><h2 className="t-h3">Verifikasi Terbaru</h2></div>
          <div className="card">
            {data && data.recent_verifications.length === 0 && <div className="empty-state">Tidak ada pengajuan yang menunggu.</div>}
            {(data?.recent_verifications || []).map((v) => (
              <div key={v.id} className="row-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="t-small" style={{ fontWeight: 700 }}>{v.name}</div>
                  <div className="t-caption">{v.university || "—"} · diajukan {date(v.submitted_at)}</div>
                </div>
                <span className="badge badge-info">Mahasiswa</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="section-title"><h2 className="t-h3">Sengketa Terbaru</h2></div>
          <div className="card">
            {data && data.recent_disputes.length === 0 && <div className="empty-state">Belum ada sengketa.</div>}
            {(data?.recent_disputes || []).map((d) => {
              const st = DISPUTE_STATUS[d.status] || { label: d.status, badge: "" };
              return (
                <div key={d.id} className="row-between" style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="t-small" style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.reason || d.project}</div>
                    <span className="badge badge-error" style={{ marginTop: 4 }}><Icon name="flag" /> {d.project || "Sengketa"}</span>
                  </div>
                  <span className={`badge ${st.badge}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
