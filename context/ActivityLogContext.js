"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { buildSeedLog, sortLogDesc } from "@/lib/activity-log";
import { adminName } from "@/lib/directory";
import { MOCK_TODAY } from "@/lib/projects.mock";
import { useRole } from "@/context/RoleContext";

// Log aktivitas admin terpusat. SEMUA fitur Verify & Trust (verifikasi,
// dana/escrow, laporan) menulis ke sini lewat log(), dan semua yang butuh
// riwayat/statistik (Profil, aksi dana di fungsi status escrow, status laporan,
// keputusan verifikasi) membaca turunannya (lib/activity-log.js). Dipasang di
// app/layout.js sebelum EscrowProvider, karena EscrowContext sekarang cuma
// lapisan tipis di atas log ini. Aksi sesi ini hilang saat refresh (belum ada
// backend), entri awal diturunkan ulang dari data.
const ActivityLogContext = createContext(null);

export function ActivityLogProvider({ children }) {
  const { user } = useRole();
  const seed = useMemo(buildSeedLog, []);
  const [runtime, setRuntime] = useState([]);

  const entries = useMemo(() => sortLogDesc([...seed, ...runtime]), [seed, runtime]);

  // `entry`: { category, action, summary, refs, meta }. Admin pelaku = user
  // yang sedang login (CURRENT_USERS.trust.adminId); selain staf, diabaikan.
  function log(entry) {
    const adminId = user?.adminId;
    if (!adminId) return;
    const now = new Date();
    const clock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setRuntime((prev) => [
      ...prev,
      {
        ...entry,
        id: `log-${Date.now()}-${prev.length}`,
        seq: prev.length + 1,
        at: `${MOCK_TODAY}T${clock}`,
        adminId, adminName: adminName(adminId),
        refs: entry.refs || {}, meta: entry.meta || {},
      },
    ]);
  }

  const value = useMemo(() => ({ entries, log }), [entries, user]);
  return <ActivityLogContext.Provider value={value}>{children}</ActivityLogContext.Provider>;
}

export function useActivityLog() {
  const ctx = useContext(ActivityLogContext);
  if (!ctx) throw new Error("useActivityLog harus dipakai di dalam <ActivityLogProvider>");
  return ctx;
}
