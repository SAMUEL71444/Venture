// Sumber kebenaran tunggal buat semua yang beda per role: menu sidebar, field
// di popup profil, dan hak akses halaman. Sidebar/UserMenu/AppShell/RoleGuard
// semuanya cuma MEMBACA config ini — nggak ada lagi if(role === "umkm") yang
// nyebar di komponen. Nambah role baru = nambah satu entri di ROLES (lihat
// catatan "Cara menambah role baru" di plan).

// Item grup "Pengaturan Pengguna" di halaman /settings — dipakai ulang
// semua role (lihat settingsNav tiap role di bawah). Item pertama (kontak)
// adalah tab default.
const USER_SETTINGS_ITEMS = [
  { id: "kontak", label: "Info Kontak" },
  { id: "profil", label: "Profil Saya" },
  { id: "pengaturan-profil", label: "Pengaturan Profil" },
  { id: "keamanan", label: "Kata Sandi & Keamanan" },
  { id: "verifikasi", label: "Verifikasi Identitas", badge: "Baru" },
  { id: "notifikasi", label: "Pengaturan Notifikasi" },
];

export const ROLES = {
  mahasiswa: {
    key: "mahasiswa",
    label: "Freelancer",
    home: "/dashboard",
    sidebarMenu: [
      { href: "/dashboard", label: "Dashboard", icon: "home" },
      { action: "search", label: "Cari Proyek", icon: "search", permission: "view_jobs" },
      { label: "Proyek Saya", icon: "folder", permission: "view_own_projects", children: [
        { href: "/projects?tab=aktif", label: "Proyek Aktif" },
        { href: "/projects?tab=semua", label: "Semua Proyek" },
        { href: "/projects?tab=disimpan", label: "Proyek yang Disimpan" },
      ] },
      { label: "Penghasilan", icon: "wallet", permission: "view_earnings", children: [
        { href: "/earnings", label: "Ringkasan" },
        { href: "/earnings?tab=transaksi", label: "Riwayat Transaksi" },
        { href: "/earnings?tab=penarikan", label: "Penarikan Dana" },
        { href: "/earnings?tab=faktur", label: "Faktur" },
      ] },
      { href: "/profile", label: "Profil", icon: "user" },
    ],
    profileFields: [
      { key: "role", label: "Peran" },
      { key: "university", label: "Kampus" },
    ],
    profileMenu: [
      { href: "/profile", label: "Profil Saya", icon: "user", group: "top" },
      { href: "/settings", label: "Pengaturan", icon: "gear", group: "bottom" },
      { href: "/help", label: "Bantuan", icon: "help", group: "bottom" },
    ],
    features: { onlineToggle: true, chatWidget: true },
    // Profil lengkap bergaya freelancer (components/profile/FreelancerProfile).
    // Role tanpa field ini tetap pakai card profil sederhana di ProfileView.
    profileLayout: "freelancer",
    notificationPrefs: ["Pesan baru", "Milestone disetujui klien", "Penarikan dana"],
    settingsNav: [
      { title: "Pembayaran", items: [{ id: "pembayaran", label: "Penarikan Dana" }] },
      { title: "Pengaturan Pengguna", items: [...USER_SETTINGS_ITEMS] },
    ],
    settings: { verificationDocs: ["KTM / KTP", "NIM & Kampus"] },
    permissions: ["view_jobs", "view_own_projects", "view_earnings", "use_chat", "edit_profile"],
  },

  umkm: {
    key: "umkm",
    label: "Pemilik UMKM",
    home: "/dashboard",
    sidebarMenu: [
      { href: "/dashboard", label: "Dashboard", icon: "home" },
      { href: "/find-talent", label: "Cari Freelancer", icon: "search", permission: "post_project" },
      { href: "/projects", label: "Proyek", icon: "folder", permission: "view_client_projects" },
      { href: "/messages", label: "Pesan", icon: "chat", permission: "use_chat" },
      { label: "Pembayaran", icon: "wallet", permission: "post_project", children: [
        { href: "/payments", label: "Ringkasan" },
        { href: "/payments?tab=riwayat", label: "Riwayat Pembayaran" },
        { href: "/payments?tab=tertahan", label: "Dana Tertahan" },
        { href: "/payments?tab=faktur", label: "Faktur" },
      ] },
      { href: "/profile", label: "Profil", icon: "user" },
    ],
    profileFields: [
      { key: "role", label: "Peran" },
      { key: "business", label: "Jenis Usaha" },
    ],
    profileMenu: [
      { href: "/profile", label: "Profil Saya", icon: "user", group: "top" },
      { href: "/settings", label: "Pengaturan", icon: "gear", group: "bottom" },
      { href: "/help", label: "Bantuan", icon: "help", group: "bottom" },
    ],
    features: { onlineToggle: true, chatWidget: true },
    notificationPrefs: ["Pesan baru", "Aplikasi masuk", "Milestone dikirim freelancer"],
    settingsNav: [
      { title: "Pembayaran", items: [{ id: "pembayaran", label: "Tagihan & Pembayaran" }] },
      // Tab default (id "kontak") di-label "Info Saya" untuk UMKM — isinya
      // panel khusus usaha (UmkmInfoPanel), lihat settings.infoPanel.
      { title: "Pengaturan Pengguna", items: USER_SETTINGS_ITEMS.map((i) => (i.id === "kontak" ? { ...i, label: "Info Saya" } : i)) },
    ],
    settings: { infoPanel: "umkm", verificationDocs: ["NIB", "Dokumen Usaha"] },
    permissions: ["view_client_projects", "use_chat", "post_project", "edit_profile"],
  },

  trust: {
    key: "trust",
    label: "Verify & Trust",
    home: "/dashboard",
    sidebarMenu: [
      { href: "/dashboard", label: "Dashboard", icon: "home" },
      { href: "/verifications", label: "Verifikasi Pengguna", icon: "shield", permission: "verify_users" },
      { href: "/escrow", label: "Transaksi & Dana", icon: "wallet", permission: "monitor_escrow" },
      { href: "/quality", label: "Kualitas Kerja", icon: "eye", permission: "monitor_quality" },
      { href: "/reports", label: "Laporan & Sengketa", icon: "flag", permission: "handle_reports" },
      { href: "/users", label: "Riwayat Pengguna", icon: "users", permission: "view_user_history" },
      { href: "/profile", label: "Profil", icon: "user" },
    ],
    profileFields: [
      { key: "role", label: "Peran" },
      { key: "adminId", label: "ID Admin" },
      { key: "accessLevel", label: "Level Akses" },
    ],
    profileMenu: [
      { href: "/profile", label: "Profil Saya", icon: "user", group: "top" },
      { href: "/settings", label: "Pengaturan", icon: "gear", group: "bottom" },
      { href: "/help", label: "Bantuan", icon: "help", group: "bottom" },
    ],
    features: { onlineToggle: false, chatWidget: false },
    notificationPrefs: ["Laporan baru", "Dana dibekukan", "Verifikasi pending"],
    // Tanpa grup Pembayaran (staf internal nggak bertransaksi) dan tanpa
    // "Pengaturan Profil" (profil internal nggak tampil publik).
    settingsNav: [
      {
        title: "Pengaturan Pengguna",
        items: USER_SETTINGS_ITEMS.filter((i) => i.id !== "pengaturan-profil").map((i) => (i.id === "kontak" ? { ...i, label: "Info Saya" } : i)),
      },
    ],
    settings: { infoPanel: "trust", verificationDocs: [] },
    permissions: [
      "view_trust_dashboard", "verify_users", "monitor_escrow", "act_on_escrow",
      "monitor_quality", "handle_reports", "view_user_history", "edit_profile",
    ],
  },
};

// Permission yang dibutuhkan tiap prefix URL. `null`/nggak ada di daftar =
// semua role yang login boleh buka (mis. /dashboard, /profile, /settings).
// Butuh SALAH SATU permission di array (bukan semuanya) — itu cara
// /projects dipakai lintas role (freelancer: view_own_projects, UMKM:
// view_client_projects) tanpa bikin key terpisah per role.
export const ROUTE_PERMISSIONS = {
  "/projects": ["view_own_projects", "view_client_projects"],
  "/earnings": ["view_earnings"],
  "/messages": ["use_chat"],
  "/find-talent": ["post_project"],
  "/payments": ["post_project"],
  "/verifications": ["verify_users"],
  "/escrow": ["monitor_escrow"],
  "/quality": ["monitor_quality"],
  "/reports": ["handle_reports"],
  "/users": ["view_user_history"],
};

export function can(roleKey, permission) {
  if (!permission) return true;
  return !!ROLES[roleKey]?.permissions.includes(permission);
}

// Dicocokkan lewat prefix terpanjang yang match (mis. "/projects/mp1" tetap
// kena aturan "/projects"), path tanpa query string.
export function canAccess(roleKey, pathname) {
  if (!ROLES[roleKey]) return false;
  const path = pathname.split("?")[0];
  const match = Object.keys(ROUTE_PERMISSIONS)
    .filter((prefix) => path === prefix || path.startsWith(prefix + "/"))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) return true; // nggak diatur -> boleh semua role yang login
  return ROUTE_PERMISSIONS[match].some((perm) => can(roleKey, perm));
}

// Menu sidebar untuk role ini, sudah disaring sesuai permission-nya.
export function navFor(roleKey) {
  const menu = ROLES[roleKey]?.sidebarMenu || [];
  return menu.filter((item) => can(roleKey, item.permission));
}
