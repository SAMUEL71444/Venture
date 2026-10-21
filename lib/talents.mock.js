// Data dummy halaman "Cari Freelancer" (/find-talent, sisi UMKM). s1–s6
// SENGAJA sama dengan STUDENTS (lib/mock-data.js) — nama, kampus, jurusan,
// kota, avatarBg, rating — dan Nadia (s1) diselaraskan dengan
// FREELANCER_PROFILE (lib/profile.mock.js): tarif Rp 50.000/jam & judul yang
// sama. s7–s10 tambahan supaya bidangnya bervariasi.

// `true` = UMKM dianggap belum punya proyek terbuka, supaya tombol
// "Lengkapi Postingan Proyek" di modal undangan bisa dilihat. Pola sama
// dengan USE_EMPTY_STATE di lib/projects.mock.js.
export const SIMULATE_NO_OPEN_PROJECTS = false;

export const TALENT_BADGES = {
  unggulan: { label: "Mahasiswa Unggulan", className: "badge-primary", icon: "award" },
  terverifikasi: { label: "Terverifikasi", className: "badge-success", icon: "shield" },
  baru: { label: "Talenta Baru", className: "badge-info", icon: "star" },
};

export const SKILL_LEVELS = { 1: "Dasar", 2: "Menengah", 3: "Mahir" };

// Offset jam per zona waktu Indonesia, dipakai hitung "waktu setempat".
export const TIMEZONE_OFFSET = { WIB: 7, WITA: 8, WIT: 9 };

export const TALENTS = [
  {
    id: "s1", name: "Nadia Putri", title: "Graphic Designer & Konten Sosial Media",
    uni: "Universitas Indonesia", major: "Desain Komunikasi Visual", education: "S1",
    city: "Depok", timezone: "WIB", avatarBg: "#EADFF0", category: "Social Media",
    rate: 50000, badge: "unggulan", boosted: true, available: true,
    successRate: 98, earnings: 12400000, totalProjects: 23, totalHours: 310, rating: 4.9, reviewCount: 21, responseTime: "< 2 jam",
    association: "BEM Fakultas, Universitas Indonesia",
    bio: "Fokus di konten sosial media untuk F&B dan retail lokal selama 2 tahun terakhir. Senang bekerja cepat, komunikatif, dan terbuka terhadap revisi.",
    summary: "Desainer konten sosial media yang konsisten dipilih UMKM F&B. Proyek unggulannya meliputi kalender konten bulanan Kopi Anteng dan desain menu Warung Ibu Sari. Kuat di Canva, Illustrator, dan copywriting singkat untuk caption.",
    skills: [
      { name: "Instagram Content", level: 3 }, { name: "Canva", level: 3 }, { name: "Copywriting", level: 2 },
      { name: "Illustrator", level: 2 }, { name: "Content Planning", level: 3 }, { name: "Desain Menu", level: 2 },
    ],
    portfolio: [
      { id: "pf1", title: "Feed Instagram Kopi Anteng", icon: "chat" },
      { id: "pf2", title: "Menu Warung Ibu Sari", icon: "fileText" },
      { id: "pf3", title: "Kemasan Sambal Bu Yuli", icon: "award" },
      { id: "pf4", title: "Katalog Toko Kue Bu Rina", icon: "folder" },
    ],
    reviews: [
      { id: "r1", project: "Desain Menu & Banner Promosi", date: "2026-08-20", rating: 5, comment: "Desain menunya bagus, pelanggan banyak yang memuji. Revisi cepat dan selalu mengabari progres tanpa diminta.", tags: ["Komunikatif", "Tepat Waktu"] },
      { id: "r2", project: "Foto Produk & Katalog Digital", date: "2026-04-26", rating: 5, comment: "Foto produknya menarik, katalog jadi lebih profesional. Akan kerja sama lagi untuk katalog lebaran.", tags: ["Kreatif", "Kolaboratif"] },
      { id: "r3", project: "Redesain Kemasan Produk Sambal", date: "2026-08-30", rating: 4, comment: "Hasil akhir bagus, ada sedikit revisi di awal karena brief saya kurang jelas, tapi Nadia sabar menjelaskan opsinya.", tags: ["Sabar", "Detail"] },
      { id: "r4", project: "Konten Ramadan Toko Hijab", date: "2026-03-10", rating: 5, comment: "Kontennya pas dengan target pembeli kami. Engagement naik dua kali lipat bulan itu.", tags: ["Paham Pasar"] },
    ],
    workHistory: [
      { id: "w1", title: "Desain Konten Instagram Bulanan", status: "berjalan", rating: null, paid: 750000, rate: 50000, hours: 15, start: "2026-09-01", end: null, desc: "12 desain feed dan 4 reels untuk promosi menu baru." },
      { id: "w2", title: "Desain Menu & Banner Promosi", status: "selesai", rating: 5, paid: 450000, rate: 50000, hours: 9, start: "2026-08-05", end: "2026-08-19", desc: "Menu dine-in baru dan 3 banner promosi untuk media sosial." },
      { id: "w3", title: "Foto Produk & Katalog Digital", status: "selesai", rating: 5, paid: 700000, rate: 50000, hours: 14, start: "2026-04-06", end: "2026-04-25", desc: "Foto 30 produk dan katalog PDF siap kirim lewat WhatsApp." },
    ],
    experience: [
      { id: "e1", title: "Desainer Grafis Magang", org: "Studio Kreatif Kota", period: "Jun 2025 – Agu 2025" },
      { id: "e2", title: "Admin Sosial Media (paruh waktu)", org: "Toko Kue Bu Rina", period: "Jan 2025 – Mei 2025" },
    ],
  },
  {
    id: "s2", name: "Rangga Saputra", title: "Web Developer (Next.js & WordPress)",
    uni: "Institut Teknologi Bandung", major: "Teknik Informatika", education: "S1",
    city: "Bandung", timezone: "WIB", avatarBg: "#DDEDE3", category: "Website",
    rate: 120000, badge: "unggulan", boosted: false, available: true,
    successRate: 100, earnings: 21800000, totalProjects: 14, totalHours: 260, rating: 5.0, reviewCount: 13, responseTime: "< 4 jam",
    association: "HMIF ITB",
    bio: "Bangun website untuk 10+ UMKM, dari landing page sampai sistem pemesanan sederhana. Selalu menyertakan panduan pakai setelah rilis.",
    summary: "Developer web yang spesialis company profile dan landing page cepat untuk UMKM. Biasa memakai Next.js atau WordPress tergantung kebutuhan klien, dan selalu memberi 1 bulan pendampingan setelah rilis.",
    skills: [
      { name: "Website", level: 3 }, { name: "React", level: 3 }, { name: "Next.js", level: 3 },
      { name: "WordPress", level: 2 }, { name: "UI/UX", level: 2 }, { name: "SEO", level: 1 },
    ],
    portfolio: [
      { id: "pf1", title: "Landing Page Batik Asri", icon: "folder" },
      { id: "pf2", title: "Sistem Pre-order Kedai", icon: "briefcase" },
      { id: "pf3", title: "Company Profile Furniture", icon: "home" },
    ],
    reviews: [
      { id: "r1", project: "Landing Page Pre-order Batik", date: "2026-07-31", rating: 5, comment: "Landing page-nya cepat dan sesuai brand kami. Penjualan pre-order jalan lancar sejak hari pertama.", tags: ["Profesional", "Cepat"] },
      { id: "r2", project: "Website Katalog Kopi", date: "2026-05-14", rating: 5, comment: "Rangga menjelaskan hal teknis dengan bahasa yang mudah. Websitenya mudah kami update sendiri.", tags: ["Komunikatif"] },
      { id: "r3", project: "Perbaikan Kecepatan Website", date: "2026-02-02", rating: 5, comment: "Loading website turun dari 6 detik ke 1,5 detik. Sangat memuaskan.", tags: ["Ahli Teknis"] },
    ],
    workHistory: [
      { id: "w1", title: "Website Company Profile Sederhana", status: "berjalan", rating: null, paid: 1200000, rate: 120000, hours: 10, start: "2026-09-05", end: null, desc: "Website 5 halaman untuk showcase produk furniture." },
      { id: "w2", title: "Landing Page Pre-order Batik", status: "selesai", rating: 5, paid: 1800000, rate: 120000, hours: 15, start: "2026-07-01", end: "2026-07-31", desc: "Landing page pre-order dengan form pemesanan dan integrasi WhatsApp." },
    ],
    experience: [
      { id: "e1", title: "Frontend Engineer Intern", org: "Startup Logistik Bandung", period: "Jun 2025 – Sep 2025" },
    ],
  },
  {
    id: "s3", name: "Dewi Lestari", title: "Digital Bookkeeping & Laporan Keuangan UMKM",
    uni: "Universitas Gadjah Mada", major: "Manajemen", education: "S1",
    city: "Yogyakarta", timezone: "WIB", avatarBg: "#F5E5D9", category: "Digital Bookkeeping",
    rate: 45000, badge: "terverifikasi", boosted: false, available: true,
    successRate: 96, earnings: 8900000, totalProjects: 19, totalHours: 240, rating: 4.8, reviewCount: 17, responseTime: "< 3 jam",
    association: null,
    bio: "Bantu UMKM rapikan pembukuan dan laporan bulanan supaya lebih mudah cari pinjaman modal.",
    summary: "Mahasiswa manajemen yang membantu UMKM pindah dari catatan manual ke spreadsheet rapi. Laporan laba rugi dan arus kasnya sudah dipakai beberapa klien untuk pengajuan KUR.",
    skills: [
      { name: "Digital Bookkeeping", level: 3 }, { name: "Excel", level: 3 }, { name: "Laporan Keuangan", level: 3 },
      { name: "Google Sheets", level: 2 },
    ],
    portfolio: [
      { id: "pf1", title: "Template Kas Harian", icon: "fileText" },
      { id: "pf2", title: "Laporan Laba Rugi Laundry", icon: "trendingUp" },
      { id: "pf3", title: "Dashboard Stok Sembako", icon: "activity" },
    ],
    reviews: [
      { id: "r1", project: "Rapikan Pembukuan 6 Bulan Terakhir", date: "2026-08-22", rating: 5, comment: "Laporannya rapi dan mudah dipahami. Sangat membantu waktu kami mengajukan pinjaman.", tags: ["Teliti", "Rapi"] },
      { id: "r2", project: "Laporan Stok & Kas Mingguan", date: "2026-06-26", rating: 4, comment: "Tepat waktu dan teliti. Template-nya masih kami pakai sampai sekarang.", tags: ["Tepat Waktu"] },
      { id: "r3", project: "Setup Pembukuan Toko Online", date: "2026-03-18", rating: 5, comment: "Dewi sabar mengajari karyawan kami cara input transaksi harian.", tags: ["Sabar", "Komunikatif"] },
    ],
    workHistory: [
      { id: "w1", title: "Rapikan Pembukuan 6 Bulan Terakhir", status: "selesai", rating: 5, paid: 800000, rate: 45000, hours: 18, start: "2026-08-01", end: "2026-08-22", desc: "Migrasi catatan manual ke spreadsheet dan laporan laba rugi." },
      { id: "w2", title: "Laporan Keuangan Bulanan Kafe", status: "berjalan", rating: null, paid: 270000, rate: 45000, hours: 6, start: "2026-09-08", end: null, desc: "Laporan kas masuk-keluar bulanan dalam format siap pakai." },
    ],
    experience: [
      { id: "e1", title: "Asisten Praktikum Akuntansi", org: "FEB Universitas Gadjah Mada", period: "2025 – sekarang" },
    ],
  },
  {
    id: "s4", name: "Farhan Maulana", title: "Logo & Brand Identity Designer",
    uni: "Universitas Bina Nusantara", major: "Desain Grafis", education: "S1",
    city: "Jakarta", timezone: "WIB", avatarBg: "#F0E3E0", category: "Graphic Design",
    rate: 75000, badge: "unggulan", boosted: true, available: false,
    successRate: 97, earnings: 26500000, totalProjects: 31, totalHours: 420, rating: 4.9, reviewCount: 28, responseTime: "< 6 jam",
    association: "Komunitas Desain Binus",
    bio: "Sudah merancang identitas visual untuk lebih dari 30 usaha kecil, dari kedai kopi sampai laundry.",
    summary: "Desainer identitas merek dengan 30+ klien UMKM. Selalu mulai dari riset dan moodboard, lalu menyerahkan logo final beserta panduan merek ringkas dan file sumber.",
    skills: [
      { name: "Logo", level: 3 }, { name: "Branding", level: 3 }, { name: "Ilustrasi", level: 2 },
      { name: "Illustrator", level: 3 }, { name: "Brand Guideline", level: 3 },
    ],
    portfolio: [
      { id: "pf1", title: "Logo Kopi Anteng", icon: "award" },
      { id: "pf2", title: "Brand Kit Laundry Kilat", icon: "folder" },
      { id: "pf3", title: "Maskot Snack Kriuk", icon: "heart" },
      { id: "pf4", title: "Panduan Merek Batik Asri", icon: "fileText" },
    ],
    reviews: [
      { id: "r1", project: "Pembuatan Logo & Panduan Merek", date: "2026-09-12", rating: 5, comment: "Konsep logonya kuat dan punya cerita. Panduan mereknya memudahkan kami cetak kemasan.", tags: ["Kreatif", "Profesional"] },
      { id: "r2", project: "Rebranding Laundry", date: "2026-05-02", rating: 5, comment: "Pelanggan langsung bilang tokonya terlihat lebih modern.", tags: ["Kolaboratif"] },
      { id: "r3", project: "Ilustrasi Maskot", date: "2026-01-20", rating: 4, comment: "Maskotnya lucu, hanya butuh satu putaran revisi warna.", tags: ["Responsif"] },
    ],
    workHistory: [
      { id: "w1", title: "Pembuatan Logo & Panduan Merek", status: "berjalan", rating: null, paid: 900000, rate: 75000, hours: 12, start: "2026-09-05", end: null, desc: "Logo baru dan panduan merek ringkas untuk lini kopi kemasan." },
      { id: "w2", title: "Rebranding Laundry Kilat Bersih", status: "selesai", rating: 5, paid: 1500000, rate: 75000, hours: 20, start: "2026-04-01", end: "2026-05-02", desc: "Logo, papan nama, dan template media sosial." },
    ],
    experience: [
      { id: "e1", title: "Junior Designer", org: "Agensi Branding Jakarta", period: "Jan 2025 – Jun 2025" },
    ],
  },
  {
    id: "s5", name: "Kirana Ayu", title: "Social Media Strategist & Content Planner",
    uni: "Telkom University", major: "Ilmu Komunikasi", education: "S1",
    city: "Bandung", timezone: "WIB", avatarBg: "#DEE7F2", category: "Social Media",
    rate: 40000, badge: "terverifikasi", boosted: false, available: true,
    successRate: 92, earnings: 5600000, totalProjects: 11, totalHours: 150, rating: 4.7, reviewCount: 10, responseTime: "< 2 jam",
    association: null,
    bio: "Senang membantu UMKM menemukan gaya konten yang cocok dengan audiens mereka.",
    summary: "Perencana konten yang fokus ke strategi: riset audiens, kalender konten, dan evaluasi performa bulanan untuk Instagram dan TikTok.",
    skills: [
      { name: "Social Media", level: 3 }, { name: "TikTok", level: 2 }, { name: "Content Planning", level: 3 },
      { name: "Copywriting", level: 2 },
    ],
    portfolio: [
      { id: "pf1", title: "Kalender Konten Kedai Seduh", icon: "calendar" },
      { id: "pf2", title: "Kampanye TikTok Snack", icon: "trendingUp" },
      { id: "pf3", title: "Laporan Insight Bulanan", icon: "activity" },
    ],
    reviews: [
      { id: "r1", project: "Strategi Konten 3 Bulan", date: "2026-07-15", rating: 5, comment: "Kirana bikin kami paham kenapa konten tertentu ramai dan yang lain tidak.", tags: ["Analitis", "Komunikatif"] },
      { id: "r2", project: "Kampanye Pembukaan Cabang", date: "2026-04-08", rating: 4, comment: "Konsepnya bagus, eksekusi sedikit molor sehari tapi dikabari sebelumnya.", tags: ["Kreatif"] },
      { id: "r3", project: "Audit Akun Instagram", date: "2026-02-11", rating: 5, comment: "Rekomendasinya jelas dan langsung bisa kami jalankan.", tags: ["Praktis"] },
    ],
    workHistory: [
      { id: "w1", title: "Strategi Konten 3 Bulan", status: "selesai", rating: 5, paid: 1200000, rate: 40000, hours: 30, start: "2026-04-15", end: "2026-07-15", desc: "Riset audiens, kalender konten, dan evaluasi bulanan." },
      { id: "w2", title: "Konten TikTok Mingguan", status: "berjalan", rating: null, paid: 320000, rate: 40000, hours: 8, start: "2026-09-02", end: null, desc: "3 ide video dan naskah singkat per minggu." },
    ],
    experience: [
      { id: "e1", title: "Content Intern", org: "Media Lokal Bandung", period: "Jul 2025 – Sep 2025" },
    ],
  },
  {
    id: "s6", name: "Bagas Wirawan", title: "Marketplace Specialist (Shopee & Tokopedia)",
    uni: "Universitas Diponegoro", major: "Sistem Informasi", education: "S1",
    city: "Semarang", timezone: "WIB", avatarBg: "#E4EEDC", category: "Marketplace",
    rate: 40000, badge: "terverifikasi", boosted: true, available: true,
    successRate: 95, earnings: 7300000, totalProjects: 16, totalHours: 200, rating: 4.8, reviewCount: 15, responseTime: "< 1 jam",
    association: null,
    bio: "Ahli mendaftarkan dan mengoptimalkan toko UMKM di marketplace besar.",
    summary: "Spesialis marketplace yang menangani setup toko, unggah katalog, dan optimasi judul serta foto produk berdasarkan riset kata kunci.",
    skills: [
      { name: "Marketplace Setup", level: 3 }, { name: "Shopee", level: 3 }, { name: "Tokopedia", level: 3 },
      { name: "Marketplace SEO", level: 2 }, { name: "Product Listing", level: 3 },
    ],
    portfolio: [
      { id: "pf1", title: "Toko Shopee Kopi Anteng", icon: "briefcase" },
      { id: "pf2", title: "Katalog Tokopedia Batik", icon: "folder" },
      { id: "pf3", title: "Optimasi Judul Snack", icon: "search" },
    ],
    reviews: [
      { id: "r1", project: "Pendaftaran & Optimasi Toko Shopee", date: "2026-09-16", rating: 5, comment: "Toko kami langsung muncul di pencarian. Penjualan minggu pertama di atas target.", tags: ["Hasil Nyata"] },
      { id: "r2", project: "Migrasi Katalog ke Tokopedia", date: "2026-06-03", rating: 5, comment: "40 produk dipindah tanpa satu pun salah harga. Teliti sekali.", tags: ["Teliti", "Cepat"] },
      { id: "r3", project: "Foto Ulang Produk", date: "2026-03-22", rating: 4, comment: "Hasilnya bagus, komunikasi lancar.", tags: ["Komunikatif"] },
    ],
    workHistory: [
      { id: "w1", title: "Pendaftaran & Optimasi Toko Shopee", status: "selesai", rating: 5, paid: 900000, rate: 40000, hours: 22, start: "2026-08-28", end: "2026-09-16", desc: "Setup toko dan optimasi 20 varian kopi kemasan." },
      { id: "w2", title: "Setup Toko Tokopedia + Katalog", status: "berjalan", rating: null, paid: 240000, rate: 40000, hours: 6, start: "2026-09-10", end: null, desc: "Migrasi katalog 40 produk lengkap dengan deskripsi." },
    ],
    experience: [
      { id: "e1", title: "Admin Toko Online (paruh waktu)", org: "Distributor Batik Semarang", period: "2024 – 2025" },
    ],
  },
  {
    id: "s7", name: "Putri Anggraini", title: "Data Analyst & Dashboard Excel",
    uni: "Universitas Airlangga", major: "Statistika", education: "S1",
    city: "Surabaya", timezone: "WIB", avatarBg: "#E6E1F5", category: "Data",
    rate: 60000, badge: "terverifikasi", boosted: false, available: true,
    successRate: 94, earnings: 6100000, totalProjects: 9, totalHours: 130, rating: 4.8, reviewCount: 8, responseTime: "< 4 jam",
    association: "Himpunan Statistika Unair",
    bio: "Mengubah data penjualan UMKM jadi dashboard sederhana yang gampang dibaca setiap minggu.",
    summary: "Analis data yang membuat dashboard penjualan dan stok di Excel/Looker Studio, lengkap dengan ringkasan insight mingguan untuk pemilik usaha.",
    skills: [
      { name: "Excel", level: 3 }, { name: "Analisis Data", level: 3 }, { name: "Looker Studio", level: 2 },
      { name: "Google Sheets", level: 3 }, { name: "Python", level: 1 },
    ],
    portfolio: [
      { id: "pf1", title: "Dashboard Penjualan Kafe", icon: "activity" },
      { id: "pf2", title: "Analisis Menu Terlaris", icon: "trendingUp" },
      { id: "pf3", title: "Prediksi Stok Bulanan", icon: "calendar" },
    ],
    reviews: [
      { id: "r1", project: "Dashboard Penjualan Mingguan", date: "2026-08-10", rating: 5, comment: "Sekarang saya tahu menu mana yang rugi. Dashboard-nya sangat jelas.", tags: ["Analitis", "Jelas"] },
      { id: "r2", project: "Analisis Data Pelanggan", date: "2026-05-27", rating: 5, comment: "Putri memberi rekomendasi promo berdasarkan data, bukan tebakan.", tags: ["Insightful"] },
      { id: "r3", project: "Rapikan Data Stok", date: "2026-02-15", rating: 4, comment: "Hasilnya rapi, butuh waktu sedikit lebih lama dari perkiraan.", tags: ["Teliti"] },
    ],
    workHistory: [
      { id: "w1", title: "Dashboard Penjualan Mingguan", status: "selesai", rating: 5, paid: 1080000, rate: 60000, hours: 18, start: "2026-07-20", end: "2026-08-10", desc: "Dashboard Excel otomatis dari data kasir harian." },
      { id: "w2", title: "Analisis Stok Gudang", status: "berjalan", rating: null, paid: 360000, rate: 60000, hours: 6, start: "2026-09-09", end: null, desc: "Analisis perputaran stok dan rekomendasi pemesanan ulang." },
    ],
    experience: [
      { id: "e1", title: "Data Intern", org: "Bank Daerah Jawa Timur", period: "Jul 2025 – Des 2025" },
    ],
  },
  {
    id: "s8", name: "Yoga Pratama", title: "Video Editor & Konten TikTok",
    uni: "Universitas Udayana", major: "Ilmu Komunikasi", education: "D3",
    city: "Denpasar", timezone: "WITA", avatarBg: "#F5EBD9", category: "Video",
    rate: 55000, badge: "baru", boosted: false, available: true,
    successRate: 88, earnings: 2100000, totalProjects: 5, totalHours: 60, rating: 4.6, reviewCount: 4, responseTime: "< 2 jam",
    association: null,
    bio: "Editor video pendek untuk TikTok dan Reels dengan gaya cepat dan cerita yang jelas.",
    summary: "Talenta baru yang fokus di video pendek: dari naskah singkat, pengambilan gambar sederhana dengan HP, sampai editing dan subtitle untuk TikTok dan Reels.",
    skills: [
      { name: "Video Editing", level: 3 }, { name: "TikTok", level: 3 }, { name: "CapCut", level: 3 },
      { name: "Premiere Pro", level: 2 }, { name: "Storytelling", level: 2 },
    ],
    portfolio: [
      { id: "pf1", title: "Reels Pantai Kafe", icon: "eye" },
      { id: "pf2", title: "Behind the Scene Bakery", icon: "users" },
      { id: "pf3", title: "Video Promo Homestay", icon: "home" },
    ],
    reviews: [
      { id: "r1", project: "Video Promo Homestay", date: "2026-08-02", rating: 5, comment: "Videonya membuat homestay kami terlihat jauh lebih menarik.", tags: ["Kreatif"] },
      { id: "r2", project: "5 Video TikTok Produk", date: "2026-06-18", rating: 4, comment: "Hasil bagus, butuh arahan tambahan soal musik.", tags: ["Responsif"] },
      { id: "r3", project: "Reels Pembukaan Kafe", date: "2026-05-01", rating: 5, comment: "Cepat dan hasilnya viral di akun kami.", tags: ["Cepat", "Kreatif"] },
    ],
    workHistory: [
      { id: "w1", title: "Video Promo Homestay", status: "selesai", rating: 5, paid: 660000, rate: 55000, hours: 12, start: "2026-07-20", end: "2026-08-02", desc: "Video promosi 60 detik dan 3 potongan Reels." },
      { id: "w2", title: "Konten TikTok Bakery", status: "berjalan", rating: null, paid: 220000, rate: 55000, hours: 4, start: "2026-09-11", end: null, desc: "4 video pendek per bulan." },
    ],
    experience: [
      { id: "e1", title: "Videografer Acara Kampus", org: "UKM Fotografi Udayana", period: "2025 – sekarang" },
    ],
  },
  {
    id: "s9", name: "Aulia Rahman", title: "UI/UX Designer untuk Aplikasi & Website",
    uni: "Universitas Hasanuddin", major: "Teknik Informatika", education: "S1",
    city: "Makassar", timezone: "WITA", avatarBg: "#DCEFEF", category: "UI/UX",
    rate: 85000, badge: "unggulan", boosted: false, available: true,
    successRate: 99, earnings: 15200000, totalProjects: 12, totalHours: 210, rating: 5.0, reviewCount: 11, responseTime: "< 3 jam",
    association: "Google Developer Student Club Unhas",
    bio: "Merancang tampilan aplikasi dan website yang mudah dipakai pelanggan UMKM, dari wireframe sampai prototipe Figma.",
    summary: "Desainer UI/UX yang menjembatani kebutuhan pemilik usaha dan developer: riset pengguna singkat, wireframe, lalu prototipe Figma siap dikembangkan.",
    skills: [
      { name: "UI/UX", level: 3 }, { name: "Figma", level: 3 }, { name: "Prototyping", level: 3 },
      { name: "User Research", level: 2 }, { name: "Website", level: 2 },
    ],
    portfolio: [
      { id: "pf1", title: "Aplikasi Pemesanan Kue", icon: "briefcase" },
      { id: "pf2", title: "Redesain Website Toko", icon: "folder" },
      { id: "pf3", title: "Prototipe Kasir Sederhana", icon: "wallet" },
      { id: "pf4", title: "Design System Mini", icon: "gear" },
    ],
    reviews: [
      { id: "r1", project: "Prototipe Aplikasi Pemesanan", date: "2026-08-25", rating: 5, comment: "Prototipenya langsung bisa dipakai developer kami. Sangat detail.", tags: ["Detail", "Profesional"] },
      { id: "r2", project: "Redesain Website Toko", date: "2026-06-09", rating: 5, comment: "Konversi checkout naik setelah redesain.", tags: ["Hasil Nyata"] },
      { id: "r3", project: "Audit UX Aplikasi", date: "2026-03-04", rating: 5, comment: "Temuannya tajam dan disampaikan dengan sopan.", tags: ["Analitis", "Komunikatif"] },
    ],
    workHistory: [
      { id: "w1", title: "Prototipe Aplikasi Pemesanan", status: "selesai", rating: 5, paid: 2040000, rate: 85000, hours: 24, start: "2026-07-28", end: "2026-08-25", desc: "Wireframe dan prototipe Figma 18 layar." },
      { id: "w2", title: "Design System Website Katalog", status: "berjalan", rating: null, paid: 510000, rate: 85000, hours: 6, start: "2026-09-12", end: null, desc: "Komponen dasar dan panduan warna untuk website katalog." },
    ],
    experience: [
      { id: "e1", title: "UI Designer Intern", org: "Startup Edutech Makassar", period: "Feb 2025 – Jul 2025" },
    ],
  },
  {
    id: "s10", name: "Maria Wenda", title: "Copywriter & Penulis Deskripsi Produk",
    uni: "Universitas Cenderawasih", major: "Sastra Indonesia", education: "S1",
    city: "Jayapura", timezone: "WIT", avatarBg: "#F3E3EA", category: "Copywriting",
    rate: 35000, badge: "baru", boosted: false, available: true,
    successRate: 90, earnings: 1800000, totalProjects: 6, totalHours: 70, rating: 4.7, reviewCount: 5, responseTime: "< 5 jam",
    association: null,
    bio: "Menulis caption, deskripsi produk, dan cerita merek yang hangat dan mudah dipahami pembeli.",
    summary: "Penulis muda yang fokus ke copywriting untuk produk lokal: deskripsi marketplace, caption media sosial, dan cerita di balik merek.",
    skills: [
      { name: "Copywriting", level: 3 }, { name: "Deskripsi Produk", level: 3 }, { name: "Storytelling", level: 2 },
      { name: "SEO", level: 1 },
    ],
    portfolio: [
      { id: "pf1", title: "Cerita Merek Kopi Papua", icon: "fileText" },
      { id: "pf2", title: "Deskripsi 50 Produk Noken", icon: "folder" },
      { id: "pf3", title: "Caption Ramadan", icon: "chat" },
    ],
    reviews: [
      { id: "r1", project: "Deskripsi Produk Marketplace", date: "2026-07-30", rating: 5, comment: "Deskripsinya membuat produk kami terasa istimewa.", tags: ["Kreatif"] },
      { id: "r2", project: "Cerita Merek", date: "2026-05-12", rating: 4, comment: "Tulisan bagus, sedikit revisi soal panjang teks.", tags: ["Responsif"] },
      { id: "r3", project: "Caption Bulanan", date: "2026-03-20", rating: 5, comment: "Selalu tepat waktu dan bahasanya pas dengan pelanggan kami.", tags: ["Tepat Waktu"] },
    ],
    workHistory: [
      { id: "w1", title: "Deskripsi Produk Marketplace", status: "selesai", rating: 5, paid: 525000, rate: 35000, hours: 15, start: "2026-07-10", end: "2026-07-30", desc: "Deskripsi 50 produk noken untuk Tokopedia." },
      { id: "w2", title: "Caption Instagram Bulanan", status: "berjalan", rating: null, paid: 175000, rate: 35000, hours: 5, start: "2026-09-01", end: null, desc: "20 caption per bulan beserta tagar." },
    ],
    experience: [
      { id: "e1", title: "Penulis Lepas", org: "Media Daring Papua", period: "2025 – sekarang" },
    ],
  },
];
