"use client";

import { Suspense } from "react";
import FreelancerProfile from "@/components/profile/FreelancerProfile";
import SettingsView from "@/components/views/SettingsView";
import { useRole } from "@/context/RoleContext";

// Role dengan `profileLayout: "freelancer"` (config/roles.js) dapat profil
// lengkap bergaya Upwork; role dengan `settings.infoPanel` (UMKM, Verify &
// Trust) dapat layout Pengaturan lengkap (sub-navigasi + Info Saya) di URL
// /profile, dengan isi panel sesuai role.
export default function ProfileView() {
  const { config } = useRole();

  if (config?.profileLayout === "freelancer") {
    return (
      <Suspense fallback={null}>
        <FreelancerProfile />
      </Suspense>
    );
  }
  return <SettingsView basePath="/profile" title="Profil" />;
}
