"use client";

import AppShell from "@/components/layout/AppShell";
import ProfileView from "@/components/views/ProfileView";

// Satu halaman profil buat ketiga role — isinya (profileFields) beda lewat
// config/roles.js, bukan lewat halaman terpisah. Lihat ProfileView.js.
export default function ProfilePage() {
  return (
    <AppShell>
      <ProfileView />
    </AppShell>
  );
}
