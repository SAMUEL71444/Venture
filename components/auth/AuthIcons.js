// Ikon Lucide (lucide.dev, lisensi ISC) untuk halaman Login, Daftar, dan
// Verifikasi Email — path disalin inline seperti components/landing/
// LandingIcons.js, supaya tidak menambah dependensi lucide-react dan tidak
// mengubah components/Icon.js yang dipakai seluruh aplikasi.
const make = (paths) =>
  function AuthIcon({ size = 18, className }) {
    return (
      <svg
        width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}
        aria-hidden="true" focusable="false"
      >
        {paths}
      </svg>
    );
  };

export const IconEye = make(
  <>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <circle cx="12" cy="12" r="3" />
  </>
);
export const IconEyeOff = make(
  <>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <path d="m2 2 20 20" />
  </>
);
export const IconLock = make(
  <>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
);
export const IconMail = make(
  <>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>
);
export const IconCheck = make(<path d="M20 6 9 17l-5-5" />);
export const IconX = make(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const IconAlert = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </>
);
export const IconShieldCheck = make(
  <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </>
);
export const IconCircleCheck = make(<><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>);
export const IconClock = make(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
export const IconLoader = make(<path d="M21 12a9 9 0 1 1-6.219-8.56" />);
export const IconArrowLeft = make(<><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>);
export const IconRefresh = make(
  <>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </>
);
