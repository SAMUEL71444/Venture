"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import Drawer from "@/components/ui/Drawer";
import DataTable from "@/components/ui/DataTable";
import { useActivityLog } from "@/context/ActivityLogContext";
import { verificationDecisions } from "@/lib/activity-log";
import { PLATFORM_USERS, VERIFICATION_DOCS } from "@/lib/users.mock";
import { formatTanggal } from "@/lib/format";

const TABS = [
  { id: "mahasiswa", label: "Mahasiswa" },
  { id: "umkm", label: "UMKM" },
];

// Verifikasi Pengguna: daftar akun pending per tipe (tab Mahasiswa/UMKM),
// tiap baris bisa dibuka buat lihat dokumen dummy-nya lalu Setujui/Tolak.
// Keputusan DICATAT ke log aktivitas terpusat (context/ActivityLogContext.js)
// dan daftar "Sudah Diproses" diturunkan darinya — jadi tidak hilang saat
// pindah halaman, dan otomatis terhitung di statistik & Aktivitas Terbaru
// profil admin. Baris pindah ke "Sudah Diproses" begitu diputuskan.
export default function VerificationsView() {
  const [tab, setTab] = useState("mahasiswa");
  const { entries, log } = useActivityLog();
  const decisions = useMemo(() => verificationDecisions(entries), [entries]); // { [userId]: { action, reason } }
  const [active, setActive] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  function decide(user, action, reason) {
    log({
      category: "verifikasi", action,
      summary: `${action === "approve" ? "Menyetujui" : "Menolak"} verifikasi ${user.name}`,
      refs: { userId: user.id }, meta: { reason: reason || null, joinedAt: user.joinedAt },
    });
    setActive(null);
    setRejecting(false);
    setRejectReason("");
    showToast(action === "approve" ? `${user.name} disetujui.` : `${user.name} ditolak.`);
  }

  const pending = PLATFORM_USERS.filter((u) => u.type === tab && u.verification === "pending" && !decisions[u.id]);
  // Hanya akun yang awalnya "pending" yang masuk "Sudah Diproses" — riwayat
  // verifikasi lama (akun yang sudah terverifikasi sejak awal) ada di log,
  // bukan di tabel ini.
  const processed = PLATFORM_USERS.filter((u) => u.type === tab && u.verification === "pending" && decisions[u.id]);
  const docs = active ? VERIFICATION_DOCS[active.id] || [] : [];

  const columns = [
    { key: "name", label: "Nama", render: (u) => <span style={{ fontWeight: 700 }}>{u.name}</span> },
    { key: "info", label: tab === "mahasiswa" ? "Kampus" : "Jenis Usaha", render: (u) => (tab === "mahasiswa" ? u.university : u.business) },
    { key: "joinedAt", label: "Daftar", render: (u) => formatTanggal(u.joinedAt) },
    { key: "action", label: "", align: "right", render: (u) => <span className="link-btn">Tinjau</span> },
  ];

  const processedColumns = [
    { key: "name", label: "Nama" },
    { key: "status", label: "Keputusan", render: (u) => (
      <span className={`badge ${decisions[u.id].action === "approve" ? "badge-success" : "badge-error"}`}>
        {decisions[u.id].action === "approve" ? "Disetujui" : "Ditolak"}
      </span>
    ) },
    { key: "reason", label: "Alasan", render: (u) => decisions[u.id].reason || "—" },
  ];

  return (
    <>
      <h1 className="t-h1 mb-4">Verifikasi Pengguna</h1>
      <p className="t-body muted mb-20">Tinjau dokumen akun baru sebelum mereka bisa bertransaksi di platform.</p>

      <div className="history-tabs mb-20" role="tablist" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            className={`history-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} ({PLATFORM_USERS.filter((u) => u.type === t.id && u.verification === "pending" && !decisions[u.id]).length})
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={pending} onRowClick={setActive} empty="Tidak ada pengajuan yang menunggu." />

      {processed.length > 0 && (
        <div className="mt-24">
          <h2 className="t-h3 mb-16">Sudah Diproses</h2>
          <DataTable columns={processedColumns} rows={processed} />
        </div>
      )}

      <Drawer open={!!active} onClose={() => { setActive(null); setRejecting(false); setRejectReason(""); }} title={active?.name || "Verifikasi"}>
        {active && (
          <div className="job-detail">
            <div className="row-between">
              <span className="badge badge-info">{active.type === "mahasiswa" ? "Mahasiswa" : "UMKM"}</span>
              <span className="t-caption">Daftar {formatTanggal(active.joinedAt)}</span>
            </div>

            <div className="t-small muted mt-8">{active.type === "mahasiswa" ? active.university : active.business}</div>

            <div className="divider" />

            <div className="t-caption mb-8">DOKUMEN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {docs.map((d, i) => (
                <div key={i} className="card card-pad row-between">
                  <span className="t-small" style={{ fontWeight: 600 }}>{d.label}</span>
                  {d.file ? (
                    <span className="row gap-6 t-caption"><Icon name="fileText" /> {d.file}</span>
                  ) : (
                    <span className="t-caption">{d.value}</span>
                  )}
                </div>
              ))}
            </div>

            {rejecting && (
              <div className="mt-16">
                <label className="t-caption mb-4" style={{ display: "block" }}>ALASAN PENOLAKAN</label>
                <textarea
                  className="input" rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Wajib diisi sebelum menolak..."
                />
              </div>
            )}

            <div className="drawer-footer row gap-10">
              {rejecting ? (
                <>
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => setRejecting(false)}>Batal</button>
                  <button
                    type="button" className="btn btn-block" style={{ background: "var(--error)", color: "#fff" }}
                    disabled={!rejectReason.trim()}
                    onClick={() => decide(active, "reject", rejectReason.trim())}
                  >
                    Konfirmasi Tolak
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => setRejecting(true)}>Tolak</button>
                  <button type="button" className="btn btn-primary btn-block" onClick={() => decide(active, "approve")}>Setujui</button>
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
