import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { RoleProvider } from "@/context/RoleContext";
import { SearchPanelProvider } from "@/context/SearchPanelContext";
import { ChatProvider } from "@/context/ChatContext";
import { ActivityLogProvider } from "@/context/ActivityLogContext";
import { EscrowProvider } from "@/context/EscrowContext";
import { ProjectsProvider } from "@/context/ProjectsContext";
import ChatWidget from "@/components/messages/ChatWidget";
import RoleSwitcher from "@/components/dev/RoleSwitcher";

export const metadata = {
  title: "Digital.in — Digitalisasi UMKM bersama Talenta Mahasiswa",
};

// <meta name="viewport">: lebar mengikuti perangkat, TANPA mengunci zoom
// (tidak ada maximumScale/userScalable), dan viewport-fit=cover supaya
// padding env(safe-area-inset-*) aktif di iPhone ber-notch. theme-color
// mewarnai address bar browser mobile sesuai tema (nilai = --bg di globals.css).
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F9FC" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E0E" },
  ],
};

// Dijalankan inline di <head>, SEBELUM React hydrate — memasang data-theme
// di elemen <html> sebelum paint pertama, supaya tidak ada kedip terang
// sekilas saat pengguna sudah memilih tema gelap (lihat context/ThemeContext.js,
// yang nanti menyamakan state React-nya terhadap atribut yang sudah terpasang
// ini). Dibungkus try/catch: localStorage bisa gagal di private window dsb,
// dan kalau gagal cukup jatuh ke terang seperti biasa.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var v = localStorage.getItem("digitalin.theme");
    var dark = v === "dark" || (v !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <RoleProvider>
            <SearchPanelProvider>
              <ActivityLogProvider>
                <EscrowProvider>
                  <ProjectsProvider>
                    <ChatProvider>
                      {children}
                      <ChatWidget />
                      <RoleSwitcher />
                    </ChatProvider>
                  </ProjectsProvider>
                </EscrowProvider>
              </ActivityLogProvider>
            </SearchPanelProvider>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
