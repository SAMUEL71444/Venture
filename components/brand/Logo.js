// Logo Digital.in sebagai inline SVG: tetap tajam di ukuran/resolusi
// berapa pun (bukan raster), dan warnanya ikut design token (--primary),
// jadi otomatis konsisten kalau nanti ada dark mode.

export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect width="28" height="28" rx="8" fill="var(--primary)" />
      <path
        fill="#fff"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 6.5h6.4a7.5 7.5 0 0 1 0 15H7Zm3.4 3.3v8.4h3a4.2 4.2 0 0 0 0-8.4Z"
      />
      <circle cx="21.5" cy="19.5" r="2" fill="var(--sky)" />
    </svg>
  );
}

export function Wordmark({ className = "" }) {
  return (
    <span className={`brand-wordmark ${className}`}>
      Digital<span className="brand-wordmark-accent">.in</span>
    </span>
  );
}
