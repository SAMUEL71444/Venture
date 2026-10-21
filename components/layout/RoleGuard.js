"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccess } from "@/config/roles";
import { useRole } from "@/context/RoleContext";

// Ganjal konten halaman kalau role yang sedang login nggak boleh buka
// pathname ini (lihat ROUTE_PERMISSIONS di config/roles.js). Dipakai di
// dalam AppShell. Role yang tidak berhak diarahkan ke dashboard miliknya
// (ROLES[role].home); kontennya tidak dirender sama sekali.
export default function RoleGuard({ children }) {
  const { role, config } = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = !role || canAccess(role, pathname);

  useEffect(() => {
    if (!allowed) router.replace(config?.home || "/dashboard");
  }, [allowed, config, router]);

  return allowed ? children : null;
}
