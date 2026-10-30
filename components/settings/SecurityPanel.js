import Link from "next/link";
import SettingsCard from "./SettingsCard";
import { ComingSoon } from "./ProfileForm";

// Tab "Kata Sandi & Keamanan". Belum ada endpoint ganti kata sandi saat login;
// yang tersedia adalah alur Lupa Kata Sandi (kode OTP ke email/WhatsApp).
// Verifikasi dua langkah & daftar perangkat belum punya endpoint → "Segera hadir".
export default function SecurityPanel() {
  return (
    <>
      <SettingsCard title="Kata Sandi">
        <p className="t-small muted mt-8">
          Untuk mengganti kata sandi, pakai alur Lupa Kata Sandi: kami kirim kode ke email atau WhatsApp akunmu,
          lalu kamu bisa membuat kata sandi baru.
        </p>
        <Link href="/forgot-password" className="btn btn-secondary btn-sm mt-12">Ganti lewat Lupa Kata Sandi</Link>
      </SettingsCard>
      <ComingSoon title="Verifikasi Dua Langkah">Lapisan keamanan tambahan saat masuk belum tersedia.</ComingSoon>
      <ComingSoon title="Perangkat Aktif">Daftar perangkat yang sedang masuk ke akunmu belum tersedia.</ComingSoon>
    </>
  );
}
