// Data dummy profil freelancer (mahasiswa) — halaman /profile. Konsisten
// dengan STUDENTS[0] (lib/mock-data.js) dan CURRENT_USERS.mahasiswa
// (lib/users.mock.js): Nadia Putri, UI, DKV, Depok. Riwayat kerja TIDAK
// ditulis di sini — diambil dari proyek berstatus "selesai"
// (lib/projects.mock.js), cuma ulasannya yang disimpan di REVIEWS.

// `true` = profil dianggap 100% lengkap (video & KTM terisi), supaya badge
// "Profil Lengkap" dan growth tip di dashboard bisa dilihat tanpa mengubah
// data di bawah manual. Pola sama dengan USE_EMPTY_STATE di projects.mock.js.
export const USE_COMPLETE_PROFILE = false;

export const FREELANCER_PROFILE = {
  title: "Graphic Designer & Konten Sosial Media",
  rate: { amount: 50000, unit: "jam" },
  bio: "Mahasiswa DKV Universitas Indonesia yang fokus di konten sosial media dan identitas visual untuk F&B dan retail lokal. Sudah mengerjakan belasan proyek UMKM, dari kalender konten sampai logo dan menu. Senang bekerja cepat, komunikatif, dan terbuka terhadap revisi.",
  location: "Depok, Indonesia",
  timezoneOffset: 7,
  videoIntro: USE_COMPLETE_PROFILE ? "intro.mp4" : null,
  hoursPerWeek: "Kurang dari 30 jam/minggu",
  languages: [
    { name: "Bahasa Indonesia", level: "Native" },
    { name: "Inggris", level: "Mahir" },
  ],
  // `idStatus` diambil dari PLATFORM_USERS (lihat FreelancerProfile) supaya
  // sama dengan halaman Pengaturan; KTM/NIM belum diunggah.
  studentCardVerified: USE_COMPLETE_PROFILE,
  licenses: [],
  // Dipakai widget "Jangkau Lebih Banyak Klien" dan "Preferensi" di
  // components/dashboard/ProfileSidePanel.js.
  assessmentDone: false,
  jobPreference: null,
  categories: ["Social Media", "Graphic Design", "Branding"],
  availabilityBadge: false,
  boostProfile: false,
  education: [
    { id: "ed1", school: "Universitas Indonesia", degree: "S1 Desain Komunikasi Visual", years: "2023–2027 (perkiraan)" },
  ],
  skills: ["Instagram Content", "Canva", "Copywriting", "Illustrator", "Content Planning", "Desain Menu", "Branding"],
  portfolio: {
    published: [],
    drafts: [
      { id: "pf1", title: "Feed Instagram Kopi Anteng", category: "Social Media", note: "Draft — tinggal tambah foto hasil akhir" },
    ],
  },
  catalog: [
    { id: "ct1", title: "Paket Konten Instagram 12 Feed", price: 1200000, days: 7 },
    { id: "ct2", title: "Desain Menu & Banner Promosi", price: 450000, days: 4 },
    { id: "ct3", title: "Logo UMKM Basic", price: 800000, days: 5 },
  ],
  certifications: USE_COMPLETE_PROFILE
    ? [{ id: "cert1", title: "Google Digital Marketing Fundamentals", org: "Google / Skillshop", period: "2025", desc: "" }]
    : [],
  employment: [
    { id: "em1", title: "Desainer Grafis Magang", org: "Studio Kreatif Kota", period: "Jun 2025 – Agu 2025", desc: "Membuat materi promosi dan feed Instagram untuk 5 klien F&B lokal." },
    { id: "em2", title: "Admin Sosial Media (paruh waktu)", org: "Toko Kue Bu Rina", period: "Jan 2025 – Mei 2025", desc: "Menjadwalkan konten mingguan dan membalas pesan pelanggan." },
  ],
  otherExperiences: [
    { id: "ox1", title: "Anggota Divisi Kreatif", org: "BEM Fakultas, Universitas Indonesia", period: "2024 – sekarang", desc: "Merancang poster dan konten acara kampus." },
    { id: "ox2", title: "Juara 2 Lomba Poster Nasional", org: "Festival Desain Mahasiswa", period: "2025", desc: "" },
    { id: "ox3", title: "Proyek pribadi: Ilustrasi Kuliner Depok", org: "Non-formal", period: "2025", desc: "Seri ilustrasi 10 kuliner khas Depok untuk portofolio." },
  ],
};

// projectId (lihat MY_PROJECTS) -> ulasan klien untuk proyek yang selesai.
export const REVIEWS = {
  mp5: { rating: 5, comment: "Laporannya rapi dan mudah dipahami. Sangat membantu!" },
  mp6: { rating: 5, comment: "Desain menunya bagus, pelanggan banyak yang memuji." },
  mp8: { rating: 4, comment: "Hasil akhir bagus, ada sedikit revisi di awal." },
  mp9: { rating: 5, comment: "Foto produknya menarik, katalog jadi lebih profesional." },
  mp10: { rating: 4, comment: "Tepat waktu dan teliti." },
  mp11: { rating: 5, comment: "Landing page-nya cepat dan sesuai brand kami." },
};
