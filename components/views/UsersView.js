"use client";

import { useCallback, useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import DataTable from "@/components/ui/DataTable";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import { adminApi } from "@/lib/admin/api";
import { formatTanggal } from "@/lib/format";

const ROLE_LABEL = { UMKM: "UMKM", STUDENT: "Mahasiswa", MENTOR: "Mentor", ADMIN: "Admin" };
const STATUS = {
  ACTIVE: { label: "Aktif", badge: "badge-success" },
  PENDING_VERIFICATION: { label: "Menunggu verifikasi", badge: "badge-warning" },
  SUSPENDED: { label: "Ditangguhkan", badge: "badge-error" },
};
const VERIFICATION_LABEL = { VERIFIED: "Terverifikasi", PENDING: "Menunggu", REJECTED: "Ditolak" };
const date = (iso) => (iso ? formatTanggal(iso.slice(0, 10)) : "—");

// Riwayat Pengguna: daftar dari GET /admin/users (pencarian nama/email/HP,
// filter peran & status, terbaru dulu, berpaginasi) dan detail + rekam jejak
// dari GET /admin/users/{id}. Tangguhkan memakai POST /admin/users/{id}/suspend
// (wajib alasan; pelaku dicatat backend di audit log). Belum ada endpoint untuk
// membatalkan penangguhan.
export default function UsersView() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Pencarian dikirim setelah berhenti mengetik 300 ms.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    const params = { page, per_page: 20 };
    if (search) params.q = search;
    if (role) params.role = role;
    if (status) params.status = status;
    const res = await adminApi.users(params);
    if (!res.ok) {
      setLoadError(res.error.message);
      return;
    }
    setLoadError(null);
    setRows(res.data);
    setMeta(res.meta);
  }, [page, search, role, status]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (id) => {
    setDetail(null);
    const res = await adminApi.user(id);
    setDetail(res.ok ? res.data : { error: res.error.message });
  }, []);

  useEffect(() => {
    if (activeId) loadDetail(activeId);
  }, [activeId, loadDetail]);

  async function suspend(reason) {
    const res = await adminApi.suspendUser(activeId, reason);
    if (!res.ok) return res;
    setConfirmOpen(false);
    setToast(`${detail?.name} ditangguhkan.`);
    setTimeout(() => setToast(null), 2600);
    loadDetail(activeId);
    load();
    return res;
  }

  const columns = [
    { key: "name", label: "Nama", render: (u) => <span style={{ fontWeight: 700 }}>{u.name}</span> },
    { key: "role", label: "Peran", render: (u) => <span className="badge badge-info">{ROLE_LABEL[u.role] || u.role}</span> },
    { key: "status", label: "Status", render: (u) => <span className={`badge ${STATUS[u.status]?.badge || ""}`}>{STATUS[u.status]?.label || u.status}</span> },
    { key: "info", label: "Kampus / Usaha", render: (u) => u.university || u.business_name || "—" },
    { key: "verification", label: "Verifikasi", render: (u) => VERIFICATION_LABEL[u.verification_status] || "—" },
    { key: "registered", label: "Bergabung", render: (u) => date(u.registered_at) },
  ];

  const canSuspend = detail && !detail.error && detail.status === "ACTIVE" && detail.role !== "ADMIN";

  return (
    <>
      <h1 className="t-h1 mb-4">Riwayat Pengguna</h1>
      <p className="t-body muted mb-20">Rekam jejak tiap pengguna platform, buat konteks tambahan saat menangani laporan.</p>

      <div className="row gap-10 mb-16" style={{ flexWrap: "wrap" }}>
        <input
          className="input" style={{ flex: "1 1 240px" }} type="search" placeholder="Cari nama, email, atau nomor HP"
          aria-label="Cari pengguna" value={query} onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input" style={{ flex: "0 1 180px" }} aria-label="Filter peran" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">Semua peran</option>
          {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className="input" style={{ flex: "0 1 200px" }} aria-label="Filter status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua status</option>
          {Object.entries(STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
        </select>
      </div>

      {loadError && <div className="card card-pad mb-16" role="alert" style={{ color: "var(--error)" }}>{loadError}</div>}

      {rows === null && !loadError ? (
        <div className="empty-state">Memuat pengguna…</div>
      ) : (
        <DataTable columns={columns} rows={rows || []} onRowClick={(u) => setActiveId(u.id)} empty="Tidak ada pengguna yang cocok." />
      )}

      {meta.last_page > 1 && (
        <div className="row-between mt-16">
          <span className="t-caption">Halaman {meta.current_page} dari {meta.last_page} · {meta.total} pengguna</span>
          <div className="row gap-10">
            <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
          </div>
        </div>
      )}

      <Drawer open={!!activeId} onClose={() => setActiveId(null)} title={detail?.name || "Profil Pengguna"}>
        {!detail ? (
          <div className="empty-state">Memuat profil…</div>
        ) : detail.error ? (
          <div className="empty-state" role="alert">{detail.error}</div>
        ) : (
          <div className="job-detail">
            <div className="row-between">
              <span className="badge badge-info">{ROLE_LABEL[detail.role] || detail.role}</span>
              <span className={`badge ${STATUS[detail.status]?.badge || ""}`}>{STATUS[detail.status]?.label || detail.status}</span>
            </div>
            <div className="t-small muted mt-8">{detail.university || detail.business_name || "—"}</div>
            <div className="t-small mt-8">{detail.email || "—"}</div>
            <div className="t-small">{detail.phone || "—"}</div>
            <div className="t-caption mt-4">Bergabung {date(detail.registered_at)} · Verifikasi: {VERIFICATION_LABEL[detail.verification_status] || "—"}</div>

            <div className="job-detail-stats mt-20">
              <div><div className="t-caption">KONTRAK AKTIF</div><div className="t-h3 mt-4" style={{ fontSize: 17 }}>{detail.stats.contracts_active}</div></div>
              <div><div className="t-caption">SELESAI</div><div className="t-h3 mt-4" style={{ fontSize: 17 }}>{detail.stats.contracts_completed}</div></div>
              <div><div className="t-caption">DIBATALKAN</div><div className="t-h3 mt-4" style={{ fontSize: 17 }}>{detail.stats.contracts_cancelled}</div></div>
            </div>
            <div className="mt-16">
              <div className="t-caption">SENGKETA</div>
              <div className="t-h3 mt-4" style={{ fontSize: 17, color: detail.stats.disputes > 0 ? "var(--error)" : undefined }}>{detail.stats.disputes}</div>
            </div>
            {detail.stats.projects !== null && <div className="t-small muted mt-8">Proyek diposting: {detail.stats.projects}</div>}

            {detail.suspension && (
              <div className="card card-pad mt-16" style={{ borderColor: "var(--error)" }}>
                <div className="t-caption">DITANGGUHKAN {date(detail.suspension.suspended_at)}</div>
                <div className="t-small mt-4">{detail.suspension.reason || "—"}</div>
              </div>
            )}

            {canSuspend && (
              <div className="drawer-footer">
                <button type="button" className="btn btn-block" style={{ background: "var(--error)", color: "#fff" }} onClick={() => setConfirmOpen(true)}>
                  Tangguhkan akun
                </button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Tangguhkan akun?"
        confirmLabel="Ya, tangguhkan" danger reason="required" reasonLabel="Alasan penangguhan"
        reasonPlaceholder="Mis. transaksi di luar platform" onConfirm={suspend}
      >
        Akun <b>{detail?.name}</b> akan langsung keluar dari semua perangkat dan tidak bisa masuk lagi.
        Saat ini belum ada fitur untuk membatalkan penangguhan.
      </ConfirmDialog>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
