"use client";

import StudentProfile from "@/components/profile/StudentProfile";
import SettingsView from "@/components/views/SettingsView";
import { useRole } from "@/context/RoleContext";

// Role dengan `profileLayout: "freelancer"` (mahasiswa) mendapat profil mahasiswa
// dari data asli (StudentProfile); role lain (UMKM, Verify & Trust) memakai layout
// Pengaturan (sub-navigasi + Info Saya) di URL /profile, dengan isi panel sesuai role.
export default function ProfileView() {
  const { config } = useRole();

  if (config?.profileLayout === "freelancer") return <StudentProfile />;
  return <SettingsView basePath="/profile" title="Profil" />;
}
