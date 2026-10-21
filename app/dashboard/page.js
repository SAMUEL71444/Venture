"use client";

import AppShell from "@/components/layout/AppShell";
import FreelancerDashboard, { FreelancerDashboardAside } from "@/components/views/FreelancerDashboard";
import UmkmDashboard from "@/components/views/UmkmDashboard";
import TrustDashboard from "@/components/views/TrustDashboard";
import { useRole } from "@/context/RoleContext";

// Satu URL (/dashboard) buat ketiga role — kontennya dipilih di sini
// berdasarkan role yang sedang login, shell (sidebar, popup profil, guard
// akses) datang dari AppShell dan SAMA untuk semuanya.
export default function DashboardPage() {
  const { role } = useRole();

  if (role === "umkm") {
    return (
      <AppShell>
        <UmkmDashboard />
      </AppShell>
    );
  }

  if (role === "trust") {
    return (
      <AppShell>
        <TrustDashboard />
      </AppShell>
    );
  }

  // Panel kanan (ProfileSidePanel) cuma dimiliki dashboard freelancer, sama
  // seperti sebelumnya.
  return (
    <AppShell aside={<FreelancerDashboardAside />}>
      <FreelancerDashboard />
    </AppShell>
  );
}
