"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { IconCheck, IconLock } from "./AuthIcons";

// Kerangka halaman Login, Daftar, dan Verifikasi Email: panel brand di kiri
// (desktop; disembunyikan di mobile) + form di kanan, catatan keamanan di
// bawah form, dan tautan Kebijakan Privasi / Syarat & Ketentuan yang membuka
// modal ringkasan (belum ada halaman kebijakan tersendiri di aplikasi ini).
// Halaman memanggil usePolicy().open("privasi" | "syarat") untuk tautan di
// dalam form (mis. checkbox persetujuan saat daftar).

const PolicyContext = createContext({ open: () => {} });
export const usePolicy = () => useContext(PolicyContext);

const POLICIES = {
  privasi: {
    title: "Kebijakan Privasi",
    sections: [
      ["Data yang kami kumpulkan", "Nama, email, dan data akun yang kamu isi saat mendaftar, serta dokumen verifikasi identitas (KTM/KTP untuk mahasiswa, NIB untuk UMKM) bila kamu mengunggahnya."],
      ["Cara kami melindunginya", "Koneksi ke Digital.in terenkripsi. Password tidak pernah disimpan dalam bentuk teks biasa — kami hanya menyimpan hasil hash-nya, sehingga tim kami pun tidak bisa melihatnya."],
      ["Untuk apa data dipakai", "Mengelola akunmu, mencocokkan UMKM dengan mahasiswa, memproses pembayaran escrow, dan mengirim notifikasi penting seperti kode verifikasi. Kami tidak menjual datamu ke pihak lain."],
      ["Hak kamu", "Kamu bisa melihat, memperbarui, atau meminta penghapusan data akun kapan saja lewat Pengaturan atau dengan menghubungi tim dukungan."],
    ],
  },
  syarat: {
    title: "Syarat & Ketentuan",
    sections: [
      ["Akun", "Satu orang atau satu usaha untuk satu akun. Informasi yang kamu daftarkan harus benar dan milikmu sendiri."],
      ["Pembayaran", "Dana proyek ditahan di escrow dan baru dicairkan ke mahasiswa setelah UMKM menyetujui milestone yang dikerjakan."],
      ["Perilaku", "Komunikasi dan transaksi dilakukan di dalam platform. Penipuan, plagiarisme, atau penyalahgunaan dapat membuat akun dibekukan oleh tim Verify & Trust."],
    ],
  },
};

export default function AuthShell({ aside, topLink, children }) {
  const [policy, setPolicy] = useState(null);
  const current = policy ? POLICIES[policy] : null;

  return (
    <PolicyContext.Provider value={{ open: setPolicy }}>
      <div className="au">
        <aside className="au-aside">
          <div className="au-aside-blob" aria-hidden="true" />
          <Link href="/" className="au-brand au-brand-light" aria-label="Digital.in — beranda">
            <LogoMark size={32} /><Wordmark />
          </Link>
          <div className="au-aside-body">
            <h2 className="au-aside-title">{aside.title}</h2>
            {aside.text && <p className="au-aside-text">{aside.text}</p>}
            <ul className="au-aside-points">
              {aside.points.map((p) => (
                <li key={p}><span className="au-aside-check"><IconCheck size={14} /></span>{p}</li>
              ))}
            </ul>
          </div>
          <p className="au-aside-foot">Menghubungkan UMKM dengan talenta mahasiswa Indonesia.</p>
        </aside>

        <div className="au-main">
          <header className="au-top">
            <Link href="/" className="au-brand au-brand-mobile" aria-label="Digital.in — beranda">
              <LogoMark size={30} /><Wordmark />
            </Link>
            {topLink && (
              <p className="au-top-link">
                {topLink.text} <Link href={topLink.href} className="link-btn">{topLink.label}</Link>
              </p>
            )}
          </header>

          <main className="au-body">
            <div className="au-card">
              {children}
              <p className="au-secure">
                <IconLock size={14} /> Data kamu dienkripsi dan aman.{" "}
                <button type="button" className="link-btn" onClick={() => setPolicy("privasi")}>Kebijakan Privasi</button>
              </p>
            </div>
          </main>

          <footer className="au-foot">
            <span>© {new Date().getFullYear()} Digital.in</span>
            <nav aria-label="Tautan kebijakan">
              <button type="button" className="au-foot-link" onClick={() => setPolicy("privasi")}>Kebijakan Privasi</button>
              <button type="button" className="au-foot-link" onClick={() => setPolicy("syarat")}>Syarat & Ketentuan</button>
              <Link href="/help" className="au-foot-link">Bantuan</Link>
            </nav>
          </footer>
        </div>

        <Modal open={!!current} onClose={() => setPolicy(null)} title={current?.title || ""} width={560}>
          {current && (
            <div className="au-policy">
              {current.sections.map(([h, t]) => (
                <section key={h}>
                  <h3>{h}</h3>
                  <p>{t}</p>
                </section>
              ))}
              <p className="au-policy-note">Ringkasan ini versi prototipe; dokumen lengkap menyusul.</p>
              <button type="button" className="btn btn-primary" onClick={() => setPolicy(null)}>Saya mengerti</button>
            </div>
          )}
        </Modal>
      </div>
    </PolicyContext.Provider>
  );
}
