// Primitive shimmer bar + composed layouts, dipakai di mana pun butuh
// lazy-loading placeholder (job feed, drawer detail, dst). Reuse .sk-bar
// yang sudah ada di globals.css supaya animasi shimmer-nya konsisten.

export function SkeletonBar({ width = "100%", height = 12, radius, className = "" }) {
  return (
    <div
      className={`sk-bar ${className}`}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

export function SkeletonText({ lines = 3, lastLineWidth = "70%" }) {
  return (
    <div className="row" style={{ flexDirection: "column", gap: 8, alignItems: "stretch" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBar
          key={i}
          height={11}
          width={i === lines - 1 ? lastLineWidth : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 48 }) {
  return <SkeletonBar width={size} height={size} radius="50%" />;
}
