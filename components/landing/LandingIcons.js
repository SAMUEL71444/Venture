// Ikon SVG inline untuk homepage (dari digital.in-sam-fe/Icon.tsx, versi JS).
const make = (paths, extra = {}) =>
  function LandingIcon({ size = 20, className }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...extra}>
        {paths}
      </svg>
    );
  };

export const IconArrow = make(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconSpark = make(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />);
export const IconStore = make(<path d="M4 9 5 4h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6" />);
export const IconCap = make(<path d="M12 4 2 9l10 5 10-5-10-5ZM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />);
export const IconChat = make(<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" />);
export const IconPalette = make(
  <>
    <path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.6-3.2 2 2 0 0 1 1.6-3.2H19a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" />
    <circle cx="7.5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="8" r="1" fill="currentColor" stroke="none" />
  </>
);
export const IconGlobe = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z" />
  </>
);
export const IconTag = make(
  <>
    <path d="M20 12 12 20l-8-8V4h8l8 8Z" />
    <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
  </>
);
export const IconBook = make(<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5ZM6 19h12" />);
export const IconCheck = make(<path d="M20 6 9 17l-5-5" strokeWidth="2.2" />);
export const IconStar = make(<path d="M12 2.5 15 9l7 .6-5.3 4.6L18.3 21 12 17.2 5.7 21l1.6-6.8L2 9.6 9 9z" />, { fill: "currentColor", stroke: "none" });
export const IconShield = make(
  <>
    <path d="M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </>
);
export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </>
);
export const IconMenu = make(<path d="M4 7h16M4 12h16M4 17h16" />);

// Ikon Lucide (sun, moon, chevron-down) — path-nya disalin dari lucide.dev
// (lisensi ISC) dengan stroke 2 seperti aslinya, supaya tidak perlu menambah
// dependensi lucide-react hanya untuk tiga ikon.
export const IconSun = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </>,
  { strokeWidth: 2 }
);
export const IconMoon = make(<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />, { strokeWidth: 2 });
export const IconChevronDown = make(<path d="m6 9 6 6 6-6" />, { strokeWidth: 2 });
export const IconX = make(<path d="M18 6 6 18M6 6l12 12" />, { strokeWidth: 2 });
