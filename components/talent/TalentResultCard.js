"use client";

import Icon from "@/components/Icon";
import TalentThumb from "./TalentThumb";
import { initials } from "@/lib/mock-data";
import { formatRupiah, formatRupiahShort } from "@/lib/format";
import { TALENT_BADGES } from "@/lib/talents.mock";

const MAX_SKILLS = 4;

// Kartu hasil pencarian. Klik di mana saja (selain tombol) = buka panel
// detail lewat `onOpen` — panelnya sendiri dirender FindTalentView.
export default function TalentResultCard({ talent: t, saved, invited, onToggleSave, onInvite, onOpen }) {
  const badge = TALENT_BADGES[t.badge];
  const extraSkills = t.skills.length - MAX_SKILLS;

  return (
    <article
      className="card ft-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(t.id)}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(t.id); }}
      aria-label={`Lihat detail ${t.name}`}
    >
      <TalentThumb color={t.avatarBg} item={t.portfolio[0]} />

      <div className="ft-card-main">
        <div className="ft-card-top">
          <div className="row gap-12" style={{ minWidth: 0 }}>
            <div className="ft-avatar-wrap">
              <div className="avatar" style={{ background: t.avatarBg, width: 44, height: 44, fontSize: 14 }}>{initials(t.name)}</div>
              {t.available && <span className="ft-online-dot" aria-label="Online" />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="row gap-8" style={{ flexWrap: "wrap" }}>
                <span className="t-small" style={{ fontWeight: 600 }}>{t.name}</span>
                {t.boosted && <span className="ft-boosted">⚡ Dipromosikan</span>}
              </div>
              <div className="ft-card-title">{t.title}</div>
              <div className="t-caption">{t.uni} · {t.city}</div>
            </div>
          </div>

          <div className="row gap-8" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className="icon-circle-btn saved"
              aria-pressed={saved}
              aria-label={saved ? `Hapus ${t.name} dari simpanan` : `Simpan ${t.name}`}
              onClick={(e) => { e.stopPropagation(); onToggleSave(t.id); }}
            >
              <Icon name={saved ? "heartFilled" : "heart"} />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={invited}
              onClick={(e) => { e.stopPropagation(); onInvite(t.id); }}
            >
              {invited ? <><Icon name="check" /> Diundang</> : "Ajak ke Proyek"}
            </button>
          </div>
        </div>

        <div className="ft-meta">
          <span className="t-small" style={{ fontWeight: 700 }}>{formatRupiah(t.rate)}/jam</span>
          <span className="ft-success"><Icon name="award" /> {t.successRate}% Tingkat Keberhasilan</span>
          <span>{formatRupiahShort(t.earnings)}+ diperoleh</span>
          {t.available && <span className="ft-available">● Terbuka untuk kerja</span>}
          {badge && <span className={`badge ${badge.className}`}><Icon name={badge.icon} /> {badge.label}</span>}
        </div>

        <div className="row mt-8" style={{ flexWrap: "wrap", gap: 6 }}>
          {t.skills.slice(0, MAX_SKILLS).map((s) => <span key={s.name} className="chip">{s.name}</span>)}
          {extraSkills > 0 && <span className="chip">+{extraSkills} lainnya</span>}
        </div>

        <p className="t-small muted ft-bio mt-8">{t.bio}</p>

        {t.association && (
          <div className="ft-association mt-8"><Icon name="users" /> Terasosiasi dengan {t.association}</div>
        )}
      </div>
    </article>
  );
}
