import Link from "next/link";

// Ilustrasi SVG inline buatan sendiri (bukan aset pihak ketiga), warnanya
// ikut design token supaya otomatis konsisten kalau token berubah.
function EmptyIllustration() {
  return (
    <svg width="140" height="104" viewBox="0 0 140 104" aria-hidden="true">
      <rect x="20" y="22" width="100" height="66" rx="12" fill="var(--primary-tint)" stroke="var(--border)" />
      <path d="M40 46h60M40 60h42M40 74h52" stroke="var(--primary-light)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="108" cy="26" r="15" fill="var(--primary)" />
      <path d="m101.5 26.5 4 4 9-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function NoResultsIllustration() {
  return (
    <svg width="140" height="104" viewBox="0 0 140 104" aria-hidden="true">
      <rect x="20" y="22" width="100" height="66" rx="12" fill="var(--bg)" stroke="var(--border)" />
      <circle cx="62" cy="52" r="18" fill="none" stroke="var(--text-faint)" strokeWidth="4" />
      <line x1="75" y1="65" x2="90" y2="80" stroke="var(--text-faint)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// `variant="empty"` — belum ada proyek sama sekali di tab ini.
// `variant="no-results"` — ada proyek, tapi pencarian/filter lagi nggak cocok.
export default function ProjectsEmptyState({ variant = "empty", title, subtitle, actionLabel, actionHref, onAction }) {
  return (
    <div className="empty-state projects-empty">
      {variant === "no-results" ? <NoResultsIllustration /> : <EmptyIllustration />}
      <h3 className="t-h3 mt-16">{title}</h3>
      <p className="t-small muted mt-8" style={{ maxWidth: 340, marginLeft: "auto", marginRight: "auto" }}>
        {subtitle}
      </p>
      {actionLabel && (
        actionHref ? (
          <Link href={actionHref} className="btn btn-primary mt-20">{actionLabel}</Link>
        ) : (
          <button type="button" className="btn btn-secondary mt-20" onClick={onAction}>{actionLabel}</button>
        )
      )}
    </div>
  );
}
