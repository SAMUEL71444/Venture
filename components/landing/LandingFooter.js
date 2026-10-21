import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/Logo";

const COLUMNS = [
  { title: "Platform", links: [["Cara kerja", "#cara-kerja"], ["Untuk UMKM", "#untuk-umkm"], ["Untuk Mahasiswa", "#untuk-mahasiswa"], ["Kategori jasa", "#kategori"]] },
  { title: "Akun", links: [["Masuk", "/login"], ["Daftar", "/choose-type"], ["Lupa kata sandi", "/forgot-password"]] },
  { title: "Bantuan", links: [["Cara kerja", "#cara-kerja"], ["Masuk untuk bantuan", "/login"]] },
];

export default function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-x lp-foot-grid">
        <div>
          <Link href="/" className="lp-brand" aria-label="Digital.in"><LogoMark size={34} /><Wordmark /></Link>
          <p className="lp-foot-note">
            Menghubungkan usaha kecil dengan talenta mahasiswa untuk tumbuh di dunia digital, dengan harga yang masuk akal dan hasil yang nyata.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h4>{col.title}</h4>
            <ul>
              {col.links.map(([label, href]) => (
                <li key={label}>{href.startsWith("#") ? <a href={href}>{label}</a> : <Link href={href}>{label}</Link>}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="lp-foot-bot">
        <div className="lp-x">
          <p>© {new Date().getFullYear()} Digital.in. Dibuat untuk UMKM Indonesia.</p>
          <p>Karya mahasiswa, untuk usaha kecil yang mau naik kelas.</p>
        </div>
      </div>
    </footer>
  );
}
