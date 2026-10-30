"use client";

import Link from "next/link";
import SettingsCard from "./SettingsCard";
import { LoadState } from "./ProfileForm";
import useMyProfile from "@/components/profile/useMyProfile";
import { VERIFICATION_STATUS } from "@/lib/profile/api";

// Tab "Verifikasi Identitas". Mahasiswa: status asli dari /me/profile; pengajuan
// (email kampus / unggah KTM) di halaman /verify. UMKM & staf: belum perlu verifikasi.
export default function VerificationPanel({ config }) {
  if (config.key !== "mahasiswa") {
    return (
      <SettingsCard title="Verifikasi Identitas">
        <p className="t-small muted mt-8">
          {config.key === "umkm"
            ? "Akun UMKM tidak memerlukan verifikasi dokumen saat ini."
            : "Akun staf Verify & Trust tidak memerlukan verifikasi identitas."}
        </p>
      </SettingsCard>
    );
  }
  return <StudentVerification />;
}

function StudentVerification() {
  const { loading, error, profile, reload } = useMyProfile();
  if (loading && !profile) return <LoadState loading />;
  if (!profile) return <LoadState error={error} onRetry={reload} />;

  const s = VERIFICATION_STATUS[profile.verification_status] || { label: profile.verification_status, cls: "badge-neutral" };
  const text = {
    VERIFIED: profile.campus_email_verified_at ? "Status mahasiswamu terverifikasi lewat email kampus." : "Status mahasiswamu terverifikasi lewat KTM.",
    PENDING: profile.has_ktm
      ? "KTM-mu sedang ditinjau tim Verify & Trust, biasanya dalam 1×24 jam."
      : "Verifikasi lewat tautan di email kampus atau unggah KTM.",
    REJECTED: "Pengajuan verifikasimu ditolak. Lihat alasannya dan ajukan ulang di halaman Verifikasi.",
  }[profile.verification_status];

  return (
    <SettingsCard title="Verifikasi Mahasiswa">
      <div className="row-between mt-12 gap-16">
        <span className="t-small">Status</span>
        <span className={`badge ${s.cls}`}>{s.label}</span>
      </div>
      {text && <p className="t-small muted mt-8">{text}</p>}
      {profile.verification_status !== "VERIFIED" && (
        <Link href="/verify" className="btn btn-primary btn-sm mt-12">Buka halaman Verifikasi</Link>
      )}
    </SettingsCard>
  );
}
