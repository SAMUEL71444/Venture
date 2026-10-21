"use client";

import AppShell from "@/components/layout/AppShell";
import FindTalentView from "@/components/views/FindTalentView";

// Khusus UMKM — dibatasi lewat ROUTE_PERMISSIONS["/find-talent"] di
// config/roles.js; role lain otomatis dapat pesan "Tidak memiliki akses"
// dari RoleGuard.
export default function FindTalentPage() {
  return (
    <AppShell>
      <FindTalentView />
    </AppShell>
  );
}
