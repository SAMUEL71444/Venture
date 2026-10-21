// Data dummy (sementara — nanti diganti query Supabase per layar, satu-satu).
// Struktur field di sini adalah petunjuk awal buat desain tabel Supabase kalian nanti.

export const STUDENTS = [
  { id: "s1", name: "Nadia Putri", uni: "Universitas Indonesia", major: "Desain Komunikasi Visual", skills: ["Instagram Content", "Canva", "Copywriting"], rating: 4.9, completed: 23, price: "Rp350rb", city: "Depok", bio: "Fokus di konten sosial media untuk F&B dan retail lokal selama 2 tahun terakhir.", avatarBg: "#EADFF0" },
  { id: "s2", name: "Rangga Saputra", uni: "Institut Teknologi Bandung", major: "Teknik Informatika", skills: ["Website", "React", "UI/UX"], rating: 5.0, completed: 14, price: "Rp1.2jt", city: "Bandung", bio: "Bangun website untuk 10+ UMKM, dari landing page sampai sistem pemesanan sederhana.", avatarBg: "#DDEDE3" },
  { id: "s3", name: "Dewi Lestari", uni: "Universitas Gadjah Mada", major: "Manajemen", skills: ["Digital Bookkeeping", "Excel", "Laporan Keuangan"], rating: 4.8, completed: 19, price: "Rp250rb", city: "Yogyakarta", bio: "Bantu UMKM rapikan pembukuan dan laporan bulanan supaya lebih mudah cari pinjaman modal.", avatarBg: "#F5E5D9" },
  { id: "s4", name: "Farhan Maulana", uni: "Universitas Bina Nusantara", major: "Desain Grafis", skills: ["Logo", "Branding", "Ilustrasi"], rating: 4.9, completed: 31, price: "Rp400rb", city: "Jakarta", bio: "Sudah merancang identitas visual untuk lebih dari 30 usaha kecil, dari kedai kopi sampai laundry.", avatarBg: "#F0E3E0" },
  { id: "s5", name: "Kirana Ayu", uni: "Telkom University", major: "Ilmu Komunikasi", skills: ["Social Media", "TikTok", "Content Planning"], rating: 4.7, completed: 11, price: "Rp300rb", city: "Bandung", bio: "Senang membantu UMKM menemukan gaya konten yang cocok dengan audiens mereka.", avatarBg: "#DEE7F2" },
  { id: "s6", name: "Bagas Wirawan", uni: "Universitas Diponegoro", major: "Sistem Informasi", skills: ["Marketplace Setup", "Shopee", "Tokopedia"], rating: 4.8, completed: 16, price: "Rp275rb", city: "Semarang", bio: "Ahli mendaftarkan dan mengoptimalkan toko UMKM di marketplace besar.", avatarBg: "#E4EEDC" },
];

export const PROJECTS = [
  { id: "p1", title: "Desain Konten Instagram Bulanan", umkm: "Kopi Anteng", category: "Social Media", budget: "Rp1.500.000", deadline: "25 Sep 2026", applicants: 8, location: "Jakarta Selatan (Remote)", desc: "Butuh 12 desain feed dan 4 reels untuk promosi menu baru bulan ini.", requirements: ["Menguasai Canva atau Adobe Illustrator", "Paham tren konten F&B di Instagram", "Bisa revisi cepat, maksimal 1x24 jam"], postedAgo: "2 hari lalu", type: "Harga Tetap", level: "Menengah", skills: ["Instagram", "Canva", "Content Planning", "Copywriting"], clientVerified: true, clientRating: 4.8, clientSpent: "Rp8,4 jt dibelanjakan" },
  { id: "p2", title: "Pembuatan Logo & Panduan Merek", umkm: "Batik Asri Nusantara", category: "Branding", budget: "Rp2.000.000", deadline: "30 Sep 2026", applicants: 14, location: "Solo (Remote)", desc: "Logo baru untuk lini produk batik premium, lengkap dengan brand guideline ringkas.", requirements: ["Portofolio identitas visual minimal 3 proyek", "Paham prinsip desain batik/heritage brand", "Menyertakan file source (AI/PSD) di akhir proyek"], postedAgo: "5 hari lalu", type: "Harga Tetap", level: "Ahli", skills: ["Logo Design", "Brand Guideline", "Illustrator"], clientVerified: true, clientRating: 4.6, clientSpent: "Rp15,2 jt dibelanjakan" },
  { id: "p3", title: "Website Company Profile Sederhana", umkm: "Berkah Furniture", category: "Website", budget: "Rp3.500.000", deadline: "10 Okt 2026", applicants: 5, location: "Jepara (Remote)", desc: "Website 5 halaman untuk showcase produk furniture dan katalog harga.", requirements: ["Pengalaman membangun landing page/company profile", "Bisa pakai Next.js atau WordPress", "Termasuk 1 bulan pendampingan setelah rilis"], postedAgo: "1 hari lalu", type: "Harga Tetap", level: "Menengah", skills: ["Next.js", "WordPress", "Landing Page", "Responsive Design"], clientVerified: true, clientRating: 5.0, clientSpent: "Rp4,1 jt dibelanjakan" },
  { id: "p4", title: "Pendaftaran & Optimasi Toko Shopee", umkm: "Snack Kriuk Ibu Tini", category: "Marketplace", budget: "Rp600.000", deadline: "20 Sep 2026", applicants: 11, location: "Bandung (Remote)", desc: "Setup toko baru, unggah 25 produk, dan optimasi judul & foto produk.", requirements: ["Familiar dengan Shopee Seller Center", "Paham riset kata kunci marketplace", "Bisa kerja dengan foto produk yang sudah ada"], postedAgo: "3 hari lalu", type: "Harga Tetap", level: "Pemula", skills: ["Shopee", "Marketplace SEO", "Product Listing"], clientVerified: false, clientRating: 4.3, clientSpent: "Rp1,2 jt dibelanjakan" },
  { id: "p5", title: "Rapikan Pembukuan 6 Bulan Terakhir", umkm: "Laundry Kilat Bersih", category: "Digital Bookkeeping", budget: "Rp800.000", deadline: "22 Sep 2026", applicants: 6, location: "Malang (Remote)", desc: "Migrasi catatan manual ke spreadsheet dan buat laporan laba rugi sederhana.", requirements: ["Menguasai Excel/Google Sheets tingkat lanjut", "Paham dasar akuntansi UMKM", "Bisa menjaga kerahasiaan data keuangan"], postedAgo: "6 hari lalu", type: "Harga Tetap", level: "Menengah", skills: ["Excel", "Bookkeeping", "Laporan Keuangan"], clientVerified: true, clientRating: 4.7, clientSpent: "Rp2,5 jt dibelanjakan" },
  { id: "p6", title: "Desain Menu & Banner Promosi", umkm: "Warung Ibu Sari", category: "Graphic Design", budget: "Rp450.000", deadline: "19 Sep 2026", applicants: 9, location: "Yogyakarta (Remote)", desc: "Menu dine-in baru dan 3 banner promosi untuk media sosial.", requirements: ["Punya contoh desain menu resto/kafe", "Menguasai Canva, Figma, atau Adobe", "Siap kirim draf awal dalam 2 hari kerja"], postedAgo: "4 hari lalu", type: "Harga Tetap", level: "Pemula", skills: ["Canva", "Menu Design", "Banner"], clientVerified: false, clientRating: 4.5, clientSpent: "Rp900rb dibelanjakan" },
];

export const TEMPLATES = [
  { title: "Buat Konten Instagram", cat: "Social Media", icon: "chat", desc: "Paket konten feed & reels bulanan" },
  { title: "Buat Logo Usaha", cat: "Branding", icon: "award", desc: "Logo + panduan penggunaan dasar" },
  { title: "Bangun Website Sederhana", cat: "Website", icon: "folder", desc: "Website profil usaha 3–5 halaman" },
  { title: "Daftarkan Usaha di Marketplace", cat: "Marketplace", icon: "briefcase", desc: "Setup toko & unggah katalog produk" },
];

export function initials(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// Menu sidebar, user "sedang login", dan konstanta role lain yang DULU ada
// di sini (NAV_UMKM/NAV_MAHA/BOTTOM_*/SIDEBAR_NAV_*/CURRENT_USER_*) sudah
// pindah ke config/roles.js (navFor()) dan lib/users.mock.js (CURRENT_USERS)
// — satu sumber dipakai ketiga role lewat AppShell, bukan diduplikasi per
// role di sini lagi. Lihat plan refaktor role-based routing.