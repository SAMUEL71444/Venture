// Ilustrasi flat minimal Digital.in — SATU gaya untuk semua card ilustratif:
// isi --primary-tint/--primary-light, garis --primary 2.5px berujung bulat,
// dan satu titik aksen --sky (sama dengan titik di logo). Gaya ini sama
// dengan ilustrasi yang sudah ada (folder portofolio, trofi sertifikasi,
// ProjectsEmptyState), jadi jangan campur gaya ikon lain (3D / gradient)
// di card ilustratif. Semua warna lewat token -> otomatis ikut dark mode.

const S = { stroke: "var(--primary)", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" };

function Frame({ size, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const ART = {
  folder: (
    <>
      <path d="M12 30a8 8 0 0 1 8-8h20l8 9h28a8 8 0 0 1 8 8v31a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8V30Z" fill="var(--primary-tint)" {...S} />
      <path d="M12 42h72" {...S} />
      <rect x="38" y="52" width="20" height="8" rx="3" fill="var(--primary-light)" {...S} strokeWidth={2} />
      <circle cx="78" cy="22" r="5" fill="var(--sky)" />
    </>
  ),
  wallet: (
    <>
      <rect x="12" y="26" width="72" height="50" rx="10" fill="var(--primary-tint)" {...S} />
      <path d="M12 38h72" {...S} />
      <rect x="56" y="50" width="28" height="14" rx="7" fill="var(--primary-light)" {...S} />
      <circle cx="64" cy="57" r="2.6" fill="var(--primary)" />
      <circle cx="80" cy="20" r="5" fill="var(--sky)" />
    </>
  ),
  card: (
    <>
      <rect x="10" y="24" width="76" height="50" rx="9" fill="var(--primary-tint)" {...S} />
      <path d="M10 38h76" {...S} strokeWidth={5} />
      <path d="M20 58h20M20 66h12" stroke="var(--primary-light)" strokeWidth={4} strokeLinecap="round" />
      <circle cx="72" cy="62" r="6" fill="var(--sky)" />
    </>
  ),
  shield: (
    <>
      <path d="M48 12 20 22v22c0 18 11.5 31 28 38 16.5-7 28-20 28-38V22Z" fill="var(--primary-tint)" {...S} />
      <path d="m36 46 8 8 16-17" {...S} strokeWidth={3} />
      <circle cx="76" cy="18" r="5" fill="var(--sky)" />
    </>
  ),
  connect: (
    <>
      <circle cx="30" cy="38" r="13" fill="var(--primary-tint)" {...S} />
      <circle cx="66" cy="38" r="13" fill="var(--primary-light)" {...S} />
      <path d="M12 78c2-12 9-18 18-18s16 6 18 18M48 78c2-12 9-18 18-18s16 6 18 18" fill="none" {...S} />
      <path d="M43 38h10" {...S} />
      <circle cx="48" cy="20" r="5" fill="var(--sky)" />
    </>
  ),
};

export default function Illustration({ name, size = 96 }) {
  return <Frame size={size}>{ART[name]}</Frame>;
}
