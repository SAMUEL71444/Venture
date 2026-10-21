"use client";

// Layar tunggu selama sesi dipulihkan / sebelum pengalihan, supaya konten
// halaman yang dijaga tidak sempat berkedip tampil.
export default function SessionLoading() {
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
