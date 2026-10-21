"use client";

import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Dulu ada toast('Tautan reset telah dikirim...') sebelum pindah layar.
  // Belum ada sistem toast di versi baru ini — lihat MIGRATION-GUIDE.md
  // poin "Yang belum ikut pindah" untuk daftar hal semacam ini.
  function handleSubmit(e) {
    e.preventDefault();
    router.push("/login");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card card card-pad" style={{ padding: 32, maxWidth: 420 }}>
        <div className="auth-brand"><div className="mark">D</div><div className="name t-h3">Digital.in</div></div>
        <h2 className="t-h2" style={{ textAlign: "center" }}>Lupa kata sandi?</h2>
        <p className="t-small muted mt-8" style={{ textAlign: "center" }}>
          Masukkan email kamu, kami akan kirim tautan untuk atur ulang kata sandi.
        </p>
        <form className="mt-20" onSubmit={handleSubmit}>
          <div className="field"><label>Email</label><input className="input" type="email" placeholder="nama@email.com" /></div>
          <button type="submit" className="btn btn-primary btn-block btn-lg">Kirim Tautan Reset</button>
          <button type="button" className="btn btn-ghost btn-block mt-8" onClick={() => router.push("/login")}>
            <Icon name="chevLeft" /> Kembali ke Masuk
          </button>
        </form>
      </div>
    </div>
  );
}
