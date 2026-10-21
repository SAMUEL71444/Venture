"use client";

import AppShell from "@/components/layout/AppShell";
import HelpView from "@/components/views/HelpView";

// Satu halaman buat ketiga role (tidak ada entri di ROUTE_PERMISSIONS,
// config/roles.js — jadi semua role yang login boleh buka, lihat canAccess()).
export default function HelpPage() {
  return (
    <AppShell>
      <HelpView />
    </AppShell>
  );
}
