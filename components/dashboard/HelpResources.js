import Link from "next/link";
import Icon from "@/components/Icon";
import Illustration from "@/components/ui/Illustration";

// Tiap kartu kecil membuka Pusat Bantuan yang SUDAH terfilter lewat
// ?kategori= / ?q= (lihat HelpView), bukan link kosong.
const CARDS = [
  { art: "wallet", title: "Pembayaran", text: "Cara kerja escrow: kapan dana ditahan dan kapan cair ke freelancer.", href: "/help?kategori=pembayaran" },
  { art: "card", title: "Metode Pembayaran", text: "Atur Virtual Account, kartu, atau e-wallet pilihanmu.", href: "/help?q=metode%20pembayaran" },
  { art: "shield", title: "Trust & Safety", text: "Kapan tim Verify & Trust turun tangan menjaga akunmu.", href: "/help?kategori=keamanan" },
];

export default function HelpResources() {
  return (
    <section className="ud-section">
      <div className="ud-section-head">
        <h2 className="ud-section-title">Bantuan &amp; Sumber Daya</h2>
        <Link href="/help" className="link-btn row gap-6" style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
          Lihat semua <Icon name="arrowRight" />
        </Link>
      </div>

      <div className="ud-help-hero">
        <div style={{ minWidth: 0 }}>
          <div className="ud-step-kicker">Mulai dari sini</div>
          <h3 className="ud-help-hero-title">Mulai dan terhubung dengan freelancer untuk menyelesaikan pekerjaan</h3>
          <Link href="/help" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>Pelajari</Link>
        </div>
        <div className="ud-help-hero-art"><Illustration name="connect" size={120} /></div>
      </div>

      <div className="ud-help-grid">
        {CARDS.map((c) => (
          <Link key={c.title} href={c.href} className="ud-help-card">
            <div style={{ minWidth: 0 }}>
              <div className="ud-help-card-title">{c.title}</div>
              <p className="t-small muted mt-4">{c.text}</p>
            </div>
            <Illustration name={c.art} size={64} />
          </Link>
        ))}
      </div>
    </section>
  );
}
