"use client";

import { usePathname } from "next/navigation";
import ProjectsEmptyState from "@/components/projects/ProjectsEmptyState";
import { canAccess } from "@/config/roles";
import { useRole } from "@/context/RoleContext";

// Ganjal konten halaman kalau role yang sedang login nggak boleh buka
// pathname ini (lihat ROUTE_PERMISSIONS di config/roles.js). Dipakai di
// dalam AppShell, jadi sidebar & popup profil tetap kelihatan normal —
// cuma area kontennya yang diganti pesan ini.
export default function RoleGuard({ children }) {
  const { role } = useRole();
  const pathname = usePathname();

  if (!role || canAccess(role, pathname)) return children;

  return (
    <ProjectsEmptyState
      variant="no-results"
      title="Tidak memiliki akses"
      subtitle="Akun kamu login sebagai role yang berbeda, jadi halaman ini tidak tersedia untuk kamu."
      actionLabel="Kembali ke Dashboard"
      actionHref="/dashboard"
    />
  );
}
