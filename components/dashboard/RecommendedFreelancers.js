"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import Carousel from "@/components/ui/Carousel";
import { initials } from "@/lib/mock-data";
import { formatRupiah } from "@/lib/format";

// Pengganti "konsultasi expert" (fitur itu belum ada): rekomendasi
// freelancer dari recommendTalents() (lib/umkm-dashboard.js). Kartu pertama
// gelap = ajakan menelusuri semua; sisanya kartu talent. "Lihat Profil"
// membuka panel detail di /find-talent lewat ?talent=<id>.
export default function RecommendedFreelancers({ items }) {
  return (
    <section className="ud-section">
      <div className="ud-section-head">
        <div>
          <h2 className="ud-section-title">Freelancer yang Direkomendasikan untukmu</h2>
          <p className="ud-section-sub">Disusun dari kategori proyekmu dan tingkat keberhasilan mereka di Digital.in.</p>
        </div>
        <Link href="/find-talent" className="link-btn row gap-6" style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
          Telusuri semua <Icon name="arrowRight" />
        </Link>
      </div>

      <Carousel label="Freelancer yang direkomendasikan">
        <div className="ud-rec-promo">
          <span className="ud-rec-promo-tag">Cari lebih luas</span>
          <h3>Belum ketemu yang pas?</h3>
          <p>Saring berdasarkan tarif, kampus, kota, dan tingkat keberhasilan.</p>
          <Link href="/find-talent" className="btn btn-sm ud-rec-promo-btn">Buka Cari Freelancer</Link>
        </div>

        {items.map(({ talent: t, reason, worked }) => (
          <article key={t.id} className="ud-rec-card">
            <div className="row gap-12">
              <div className="avatar" style={{ background: t.avatarBg, width: 46, height: 46, fontSize: 14 }}>{initials(t.name)}</div>
              <div style={{ minWidth: 0 }}>
                <div className="t-small" style={{ fontWeight: 700 }}>{t.name}</div>
                <div className="t-caption">{t.uni} · {t.city}</div>
              </div>
            </div>

            <div className="ud-rec-title">{t.title}</div>
            <div className="ud-rec-meta">
              <span><b>{formatRupiah(t.rate)}</b>/jam</span>
              <span>{t.successRate}% berhasil</span>
              <span><Icon name="star" /> {t.rating.toFixed(1)}</span>
            </div>
            <div className="ud-rec-reason">{reason}{worked && <span className="ud-rec-worked">Pernah kamu pakai</span>}</div>

            <p className="t-small muted ud-rec-bio">{t.bio}</p>
            <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {t.skills.slice(0, 3).map((s) => <span key={s.name} className="chip">{s.name}</span>)}
            </div>

            <Link href={`/find-talent?talent=${t.id}`} className="btn btn-secondary btn-sm btn-block" style={{ marginTop: 14 }}>
              Lihat Profil
            </Link>
          </article>
        ))}
      </Carousel>
    </section>
  );
}
