"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

export default function ChooseTypePage() {
  const router = useRouter();

  // Dulu: go('register', {regType:'umkm'}) — nyimpen regType di state global,
  // dibaca lagi di layar berikutnya. Sekarang lewat query string, jadi setiap
  // halaman berdiri sendiri dan bisa dibuka langsung via URL.
  const goRegister = (type) => router.push(`/register?type=${type}`);

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 460 }}>
        <div className="auth-brand"><div className="mark">D</div><div className="name t-h3">Digital.in</div></div>
        <h2 className="t-h2" style={{ textAlign: "center" }}>Kamu daftar sebagai apa?</h2>
        <p className="t-small muted mt-8" style={{ textAlign: "center" }}>Pilih jenis akun untuk melanjutkan pendaftaran.</p>
        <div className="mt-24" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="radio-card" onClick={() => goRegister("umkm")}>
            <div className="mark" style={{ width: 42, height: 42, borderRadius: 10, background: "var(--primary-light)", color: "var(--primary-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="briefcase" />
            </div>
            <div><div className="t-h3">Saya Pemilik UMKM</div><div className="t-small muted mt-4">Saya butuh bantuan digitalisasi untuk usaha saya.</div></div>
          </div>
          <div className="radio-card" onClick={() => goRegister("mahasiswa")}>
            <div className="mark" style={{ width: 42, height: 42, borderRadius: 10, background: "var(--primary-light)", color: "var(--primary-dark)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="award" />
            </div>
            <div><div className="t-h3">Saya Mahasiswa</div><div className="t-small muted mt-4">Saya ingin mengerjakan proyek dan membangun portofolio.</div></div>
          </div>
        </div>
        <p className="t-small muted mt-24" style={{ textAlign: "center" }}>
          Sudah punya akun? <Link className="link-btn" href="/login">Masuk</Link>
        </p>
      </div>
    </div>
  );
}
