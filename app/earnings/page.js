"use client";

import AppShell from "@/components/layout/AppShell";
import EarningsView from "@/components/views/EarningsView";

// Hanya role freelancer yang punya permission "view_earnings" (lihat
// config/roles.js) — role lain otomatis kena RoleGuard di dalam AppShell.
export default function EarningsPage() {
  return (
    <AppShell>
      <EarningsView />
    </AppShell>
  );
}
