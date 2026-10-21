// Cerita pengguna di homepage (section "Cerita mereka",
// components/landing/LandingTestimonials.js). Data dummy — nanti cukup ganti
// isi array ini dengan data asli (mis. hasil query ulasan) tanpa menyentuh
// komponennya. Bentuk tiap item:
//   { id, name, role, perspective: "umkm" | "mahasiswa", quote, rating (1–5),
//     tone: warna avatar inisial — "blue" | "sky" | "orange" | "slate"
//     (lihat .lp-av-* di app/landing.css, semuanya token tema) }
// INITIAL_TESTIMONIAL_COUNT item pertama selalu tampil; sisanya muncul lewat
// tombol "Tampilkan lebih banyak".

export const INITIAL_TESTIMONIAL_COUNT = 3;

export const TESTIMONIALS = [
  {
    id: "t1", perspective: "umkm", rating: 5, tone: "blue",
    name: "Ibu Sari", role: "Pemilik Warung Ibu Sari, Yogyakarta",
    quote: "Konten Instagram warung saya jadi rapi dan konsisten. Pesanan naik hampir dua kali lipat dalam sebulan.",
  },
  {
    id: "t2", perspective: "mahasiswa", rating: 5, tone: "sky",
    name: "Rangga Saputra", role: "Mahasiswa Informatika, Institut Teknologi Bandung",
    quote: "Dapat proyek website pertama lewat Digital.in. Portofolio bertambah dan sekarang ada pemasukan tetap.",
  },
  {
    id: "t3", perspective: "umkm", rating: 5, tone: "orange",
    name: "Pak Budi", role: "Pemilik Berkah Furniture, Jepara",
    quote: "Pembukuan usaha akhirnya rapi. Waktu ajukan pinjaman modal, laporannya langsung diterima bank.",
  },

  // --- Cerita tambahan (muncul lewat "Tampilkan lebih banyak") ---
  {
    id: "t4", perspective: "umkm", rating: 5, tone: "slate",
    name: "Teguh Wiryawan", role: "Pemilik Kedai Kopi Lereng, Bandung",
    quote: "Saya sempat ragu bayar duluan ke orang yang belum pernah saya temui. Ternyata dananya ditahan di escrow dan baru cair setelah saya setujui desain menu barunya. Menu itu sekarang dipajang di dua cabang.",
  },
  {
    id: "t5", perspective: "mahasiswa", rating: 5, tone: "orange",
    name: "Aulia Rahmadani", role: "Mahasiswa Desain Komunikasi Visual, Universitas Sebelas Maret",
    quote: "Proyek pertama saya cuma label botol sambal, Rp350 ribu. Kecil memang, tapi itu uang pertama yang saya dapat dari menggambar — dan pemiliknya sudah tiga kali pesan lagi.",
  },
  {
    id: "t6", perspective: "umkm", rating: 4, tone: "blue",
    name: "Darto Wibisono", role: "Pemilik Sate Kambing Pak Darto, Solo",
    quote: "Proyeknya saya pecah jadi tiga milestone: logo, spanduk, lalu kemasan bungkus. Tiap tahap saya cek dulu baru dibayar, jadi tidak ada yang kebablasan. Kemasan barunya bikin pesanan ojek online lebih gampang dikenali.",
  },
  {
    id: "t7", perspective: "mahasiswa", rating: 5, tone: "sky",
    name: "Dimas Prakoso", role: "Mahasiswa Ilmu Komunikasi, Universitas Diponegoro",
    quote: "Dua bulan saya pegang TikTok sebuah toko kue rumahan. Satu video resep bolu pandan tembus 180 ribu penonton. Sekarang saya punya studi kasus sungguhan untuk dilampirkan waktu melamar magang.",
  },
  {
    id: "t8", perspective: "umkm", rating: 5, tone: "orange",
    name: "Melati Anggraini", role: "Pemilik Toko Hijab Daring, Surabaya",
    quote: "Dulu foto katalog kami cuma pakai HP di teras rumah. Mahasiswa fotografer yang kami rekrut memotret ulang 60 produk dan menata toko Shopee dari nol. Bulan lalu, untuk pertama kalinya, produk kami masuk halaman rekomendasi.",
  },
  {
    id: "t9", perspective: "mahasiswa", rating: 5, tone: "slate",
    name: "Nurul Fitriani", role: "Mahasiswa Statistika, Institut Pertanian Bogor",
    quote: "Klien saya toko bangunan yang stoknya sering selisih. Saya buatkan dasbor sederhana di Google Sheets, dan selisih bulanannya turun dari belasan barang jadi dua. Bayarannya cair begitu milestone terakhir disetujui, tanpa perlu menagih.",
  },
  {
    id: "t10", perspective: "umkm", rating: 5, tone: "sky",
    name: "Rina Hapsari", role: "Pemilik Laundry Kilat Bersih, Malang",
    quote: "Yang membuat saya berani mencoba: identitas mahasiswanya sudah diverifikasi, lengkap dengan kampusnya. Alur antar-jemput lewat WhatsApp yang dia susun memangkas telepon masuk kira-kira separuhnya.",
  },
  {
    id: "t11", perspective: "mahasiswa", rating: 4, tone: "blue",
    name: "Kevin Halim", role: "Mahasiswa Sistem Informasi, Universitas Bina Nusantara",
    quote: "Awalnya saya kira revisinya bakal tanpa ujung. Karena lingkup tiap milestone sudah ditulis di awal, diskusinya jadi jelas dan website katering klien rilis tepat waktu. Proyek itu sekarang ada di urutan teratas portofolio saya.",
  },
];
