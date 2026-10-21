"use client";

import AppShell from "@/components/layout/AppShell";
import ProjectsView from "@/components/views/ProjectsView";
import { useRole } from "@/context/RoleContext";

// /projects dipakai freelancer ("Proyek Saya", proyek miliknya sendiri) dan
// UMKM ("Proyek", proyek yang dia post lintas freelancer) — satu URL, satu
// ProjectsView yang isinya beda lewat prop `perspective`. Role lain
// (Verify & Trust) otomatis kena RoleGuard di dalam AppShell.
export default function ProjectsPage() {
  const { role } = useRole();
  return (
    <AppShell>
      <ProjectsView perspective={role === "umkm" ? "client" : "freelancer"} />
    </AppShell>
  );
}
