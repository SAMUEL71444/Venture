"use client";

import { useRole } from "@/context/RoleContext";

// Layar tunggu selama sesi dipulihkan / sebelum pengalihan, supaya konten
// halaman yang dijaga tidak sempat berkedip tampil. Bila server tidak bisa
// dihubungi (status "unreachable"), tampil pesan + tombol "Coba lagi".
export default function SessionLoading() {
  const { status, retrySession } = useRole();

  if (status === "unreachable") {
    return (
      <div
        role="alert"
        style={{ minHeight: "100dvh", display: "grid", placeItems: "center", alignContent: "center", gap: 12, padding: 16, background: "var(--bg)", color: "var(--text)", textAlign: "center" }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>Tidak dapat terhubung ke server</div>
        <div style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 360 }}>
          Sesimu masih tersimpan. Periksa koneksi internet, lalu coba lagi.
        </div>
        <button type="button" className="btn btn-primary" onClick={retrySession}>Coba lagi</button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text-muted)", fontSize: 15 }}
    >
      Memuat sesi…
    </div>
  );
}
