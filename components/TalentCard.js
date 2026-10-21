"use client";

import { useRouter } from "next/navigation";
import Icon from "./Icon";
import { initials } from "@/lib/mock-data";

export default function TalentCard({ student: s }) {
  const router = useRouter();
  const goToProfile = () => router.push(`/talent/${s.id}`);

  return (
    <div className="card card-pad card-hover talent-card clickable" onClick={goToProfile}>
      <div className="head">
        <div className="avatar avatar-lg" style={{ background: s.avatarBg, color: "var(--text)" }}>
          {initials(s.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="t-h3">{s.name}</div>
          <div className="t-small muted">{s.major}</div>
          <div className="t-caption" style={{ color: "var(--text-faint)" }}>{s.uni}</div>
        </div>
      </div>
      <p className="t-small muted mt-12">{s.bio}</p>
      <div className="skills">
        {s.skills.map((k) => (
          <span key={k} className="chip">{k}</span>
        ))}
      </div>
      <div className="row-between mt-12">
        <div className="rating">
          <Icon name="star" /> {s.rating}{" "}
          <span className="faint t-small" style={{ fontWeight: 400 }}>({s.completed} proyek)</span>
        </div>
        <div className="t-small" style={{ fontWeight: 700 }}>
          {s.price}<span className="faint" style={{ fontWeight: 400 }}>/proyek</span>
        </div>
      </div>
      <button
        className="btn btn-secondary btn-block mt-12"
        onClick={(e) => { e.stopPropagation(); goToProfile(); }}
      >
        Lihat Profil
      </button>
    </div>
  );
}
