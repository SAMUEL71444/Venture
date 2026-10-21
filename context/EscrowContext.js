"use client";

import { createContext, useContext, useMemo } from "react";
import { useActivityLog } from "@/context/ActivityLogContext";
import { escrowActions, ESCROW_ACTION_LABELS } from "@/lib/activity-log";

// Aksi manual Verify & Trust atas dana escrow (Cairkan Manual / Bekukan Dana /
// Kembalikan ke UMKM). SEKARANG hanya lapisan tipis di atas log aktivitas
// terpusat (context/ActivityLogContext.js): `actions` diturunkan dari log, dan
// recordAction() menulis ke log yang sama dengan verifikasi & laporan. API-nya
// tidak berubah, jadi lib/escrow.js (fundStatusOfTerm lewat opts.actions) dan
// semua halaman yang memakainya tetap jalan — begitu satu termin dibekukan,
// Penghasilan (Nadia), Pembayaran (UMKM), dan Transaksi & Dana melihat status
// yang sama, dan aksinya otomatis muncul di Aktivitas Terbaru profil admin.
const EscrowContext = createContext(null);

export function EscrowProvider({ children }) {
  const { entries, log } = useActivityLog();
  const actions = useMemo(() => escrowActions(entries), [entries]);

  // `by` dipertahankan demi kompatibilitas pemanggil lama; pelaku sebenarnya
  // = admin yang login (dicatat log). `summary` opsional (mis. judul proyek).
  function recordAction(txId, action, by, reason, summary) {
    const projectId = txId.slice(0, txId.lastIndexOf("-"));
    log({
      category: "escrow", action,
      summary: summary || `${ESCROW_ACTION_LABELS[action]} — ${txId}`,
      refs: { txId, projectId }, meta: { reason },
    });
  }

  const value = useMemo(() => ({ actions, recordAction }), [actions, log]);

  return <EscrowContext.Provider value={value}>{children}</EscrowContext.Provider>;
}

export function useEscrow() {
  const ctx = useContext(EscrowContext);
  if (!ctx) throw new Error("useEscrow harus dipakai di dalam <EscrowProvider>");
  return ctx;
}
