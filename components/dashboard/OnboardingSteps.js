"use client";

import Link from "next/link";
import Icon from "@/components/Icon";

function Step({ done, icon, kicker, title, children }) {
  return (
    <div className={`ud-step ${done ? "done" : ""}`}>
      <span className="ud-step-icon">
        <Icon name={done ? "checkCircle" : icon} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="ud-step-kicker">{done ? "Selesai" : kicker}</div>
        <div className="ud-step-title">{title}</div>
        <p className="t-small muted mt-4">{children}</p>
      </div>
    </div>
  );
}

// Dua syarat sebelum UMKM bisa merekrut. Section ini dirender hanya kalau
// masih ada yang belum selesai (keputusan ada di UmkmDashboard).
export default function OnboardingSteps({ emailVerified, hasPaymentMethod, onVerifyEmail }) {
  return (
    <div className="ud-steps">
      <Step done={emailVerified} icon="mail" kicker="Wajib untuk merekrut" title={
        emailVerified
          ? "Email sudah terverifikasi"
          : <button type="button" className="ud-step-link" onClick={onVerifyEmail}>Verifikasi email kamu</button>
      }>
        {emailVerified
          ? "Freelancer bisa melihat bahwa akun usahamu terpercaya."
          : "Konfirmasi identitasmu dan bangun kepercayaan dengan freelancer sebelum proyek pertama."}
      </Step>

      <Step done={hasPaymentMethod} icon="wallet" kicker="Wajib untuk merekrut" title={
        hasPaymentMethod
          ? "Metode pembayaran tersimpan"
          : <Link href="/settings?tab=pembayaran" className="ud-step-link">Tambahkan metode pembayaran</Link>
      }>
        {hasPaymentMethod
          ? "Dana proyek ditahan di escrow dari metode default-mu."
          : "Mempercepat proses perekrutan — dana baru ditahan di escrow saat proyek dimulai, tanpa biaya sampai kamu merekrut."}
      </Step>
    </div>
  );
}
