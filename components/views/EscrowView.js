"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import DataTable from "@/components/ui/DataTable";
import FundStatusBadge from "@/components/escrow/FundStatusBadge";
import EscrowDetailDrawer from "@/components/escrow/EscrowDetailDrawer";
import { buildEscrowTransactions, allPaymentTerms, FUND_STATUS } from "@/lib/escrow";
import { getPlatformProjects } from "@/lib/platform-projects.mock";
import { getAllProjects, MOCK_TODAY } from "@/lib/projects.mock";
import { activeReportProjectIds } from "@/lib/reports.mock";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { useEscrow } from "@/context/EscrowContext";

// "Transaksi & Dana" — tabel SEMUA termin lintas freelancer, status dananya
// dihitung fundStatusOfTerm() yang sama dipakai Penghasilan (Nadia) & Proyek
// Saya (UMKM). Klik baris buka breakdown per milestone proyek itu + aksi
// manual (lihat EscrowDetailDrawer.js).
// `?tx=<id>` (dari Aktivitas Terbaru di Profil) langsung membuka drawer
// transaksi itu. useSearchParams wajib dibungkus <Suspense>.
export default function EscrowView() {
  return (
    <Suspense fallback={null}>
      <EscrowContent />
    </Suspense>
  );
}

function EscrowContent() {
  const { actions } = useEscrow();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(null);
  const [activeTxId, setActiveTxId] = useState(() => searchParams.get("tx"));

  const projects = useMemo(() => getPlatformProjects(getAllProjects()), []);
  const transactions = useMemo(
    () => buildEscrowTransactions(projects, allPaymentTerms(), MOCK_TODAY, { actions, frozenProjectIds: activeReportProjectIds() }),
    [projects, actions]
  );

  const filtered = statusFilter ? transactions.filter((t) => t.status === statusFilter) : transactions;
  const activeProject = activeTxId ? projects.find((p) => p.id === transactions.find((t) => t.id === activeTxId)?.projectId) : null;

  const columns = [
    { key: "client", label: "UMKM" },
    { key: "freelancerName", label: "Mahasiswa" },
    { key: "projectTitle", label: "Proyek" },
    { key: "amount", label: "Nominal", align: "right", render: (t) => formatRupiah(t.amount) },
    { key: "status", label: "Status Dana", render: (t) => <FundStatusBadge status={t.status} /> },
    { key: "date", label: "Tanggal", render: (t) => formatTanggal(t.date) },
  ];

  return (
    <>
      <h1 className="t-h1 mb-4">Transaksi & Dana</h1>
      <p className="t-body muted mb-20">Pantau dan, kalau perlu, intervensi status dana escrow tiap milestone.</p>

      <div className="row gap-8 mb-16" style={{ flexWrap: "wrap" }}>
        <button type="button" className={`chip-filter ${statusFilter === null ? "active" : ""}`} onClick={() => setStatusFilter(null)}>
          Semua Status
        </button>
        {Object.entries(FUND_STATUS).map(([key, meta]) => (
          <button key={key} type="button" className={`chip-filter ${statusFilter === key ? "active" : ""}`} onClick={() => setStatusFilter(key)}>
            {meta.label}
          </button>
        ))}
      </div>

      <DataTable columns={columns} rows={filtered} onRowClick={(t) => setActiveTxId(t.id)} empty="Tidak ada transaksi untuk status ini." />

      <EscrowDetailDrawer
        project={activeProject}
        open={!!activeProject}
        onClose={() => setActiveTxId(null)}
      />
    </>
  );
}
