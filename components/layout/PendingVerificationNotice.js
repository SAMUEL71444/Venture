"use client";

import Link from "next/link";
import ProjectsEmptyState from "@/components/projects/ProjectsEmptyState";

// Banner di atas semua halaman aplikasi untuk akun PENDING_VERIFICATION.
export function PendingVerificationBanner() {
  return (
    <div
      role="status"
      style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", marginBottom: 20, padding: "12px 16px",
        borderRadius: 12, background: "var(--warning-bg)", border: "1px solid var(--warning)", color: "var(--text)",
      }}
    >
      <div style={{ flex: "1 1 260px", fontSize: 15, lineHeight: 1.5 }}>
        <b>Akun kamu menunggu verifikasi.</b>{" "}
        Status mahasiswa perlu dipastikan lewat email kampus atau unggah KTM sebelum kamu bisa mencari proyek,
        menerima pembayaran, dan mengirim pesan.
      </div>
      <Link href="/verify" className="btn btn-primary btn-sm">Verifikasi sekarang</Link>
    </div>
  );
}

// Pengganti konten halaman yang fiturnya butuh endpoint terlarang untuk akun pending.
export function PendingVerificationGate() {
  return (
    <ProjectsEmptyState
      variant="empty"
      title="Halaman ini tersedia setelah akun terverifikasi"
      subtitle="Selesaikan verifikasi status mahasiswa (email kampus atau unggah KTM). Setelah disetujui, semua fitur langsung terbuka."
      actionLabel="Buka halaman verifikasi"
      actionHref="/verify"
    />
  );
}
