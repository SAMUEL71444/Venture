"use client";

import AppShell from "@/components/layout/AppShell";
import PaymentsView from "@/components/views/PaymentsView";

// Khusus UMKM — dibatasi lewat ROUTE_PERMISSIONS["/payments"] di
// config/roles.js; role lain otomatis dapat pesan "Tidak memiliki akses".
export default function PaymentsPage() {
  return (
    <AppShell>
      <PaymentsView />
    </AppShell>
  );
}
