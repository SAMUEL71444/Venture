"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Drawer from "@/components/ui/Drawer";
import DataTable from "@/components/ui/DataTable";
import { PLATFORM_USERS } from "@/lib/users.mock";
import { effectiveReports } from "@/lib/activity-log";
import { getPlatformProjects } from "@/lib/platform-projects.mock";
import { getAllProjects } from "@/lib/projects.mock";
import { formatTanggal } from "@/lib/format";

// Riwayat & Latar Belakang Pengguna: proyek selesai/dibatalkan dan jumlah
// laporan diterima dihitung dari data proyek & laporan yang sama dipakai
// halaman lain (bukan angka ditulis manual). Rating sengaja TIDAK ditampilkan
// di sini — belum ada dataset ulasan di platform ini (itu bagian dari batch
// "Profil" terpisah), jadi daripada mengarang angka, kolomnya dilewati.
// `?user=<id>` (dari Aktivitas Terbaru di Profil) langsung membuka profil
// pengguna itu. useSearchParams wajib dibungkus <Suspense>.
export default function UsersView() {
  return (
    <Suspense fallback={null}>
      <UsersContent />
    </Suspense>
  );
}

function UsersContent() {
  const searchParams = useSearchParams();
  // Yang disimpan cuma id — datanya diturunkan dari `rows` (sudah memuat
  // jumlah proyek selesai/dibatalkan/laporan), supaya ?user= langsung benar.
  const [activeId, setActiveId] = useState(() => (PLATFORM_USERS.some((u) => u.id === searchParams.get("user")) ? searchParams.get("user") : null));

  const projects = useMemo(() => getPlatformProjects(getAllProjects()), []);

  // Relasi lewat ID (proyek.umkmId/mahasiswaId, laporan.againstId — lihat
  // lib/directory.js), bukan pencocokan nama.
  const reports = useMemo(() => effectiveReports([]), []);
  const rows = useMemo(() => {
    return PLATFORM_USERS.map((u) => {
      const own = projects.filter((p) => (u.type === "mahasiswa" ? p.mahasiswaId === u.id : p.umkmId === u.id));
      const selesai = own.filter((p) => p.status === "selesai").length;
      const dibatalkan = own.filter((p) => p.status === "dibatalkan").length;
      const laporan = reports.filter((r) => r.againstId === u.id).length;
      return { ...u, selesai, dibatalkan, laporan };
    });
  }, [projects, reports]);
  const active = rows.find((u) => u.id === activeId) || null;

  const columns = [
    { key: "name", label: "Nama", render: (u) => <span style={{ fontWeight: 700 }}>{u.name}</span> },
    { key: "type", label: "Tipe", render: (u) => <span className="badge badge-info">{u.type === "mahasiswa" ? "Mahasiswa" : "UMKM"}</span> },
    { key: "selesai", label: "Proyek Selesai", align: "right" },
    { key: "dibatalkan", label: "Dibatalkan", align: "right" },
    { key: "laporan", label: "Laporan Diterima", align: "right", render: (u) => (
      <span style={u.laporan > 0 ? { color: "var(--error)", fontWeight: 700 } : undefined}>{u.laporan}</span>
    ) },
    { key: "joinedAt", label: "Bergabung", render: (u) => formatTanggal(u.joinedAt) },
  ];

  return (
    <>
      <h1 className="t-h1 mb-4">Riwayat Pengguna</h1>
      <p className="t-body muted mb-20">Rekam jejak tiap pengguna platform, buat konteks tambahan saat menangani laporan.</p>

      <DataTable columns={columns} rows={rows} onRowClick={(u) => setActiveId(u.id)} />

      <Drawer open={!!active} onClose={() => setActiveId(null)} title={active?.name || "Profil Pengguna"}>
        {active && (
          <div className="job-detail">
            <div className="row-between">
              <span className="badge badge-info">{active.type === "mahasiswa" ? "Mahasiswa" : "UMKM"}</span>
              <span className="t-caption">Bergabung {formatTanggal(active.joinedAt)}</span>
            </div>
            <div className="t-small muted mt-8">{active.type === "mahasiswa" ? active.university : active.business}</div>

            <div className="job-detail-stats mt-20">
              <div>
                <div className="t-caption">PROYEK SELESAI</div>
                <div className="t-h3 mt-4" style={{ fontSize: 17 }}>{active.selesai}</div>
              </div>
              <div>
                <div className="t-caption">DIBATALKAN</div>
                <div className="t-h3 mt-4" style={{ fontSize: 17 }}>{active.dibatalkan}</div>
              </div>
            </div>

            <div className="mt-16">
              <div className="t-caption">LAPORAN DITERIMA</div>
              <div className="t-h3 mt-4" style={{ fontSize: 17, color: active.laporan > 0 ? "var(--error)" : undefined }}>{active.laporan}</div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
