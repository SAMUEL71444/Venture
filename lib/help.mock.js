// Data dummy halaman Pusat Bantuan (/help). Isinya mengikuti tema aplikasi
// (escrow, verifikasi mahasiswa/UMKM, dst), supaya jawabannya konsisten
// dengan perilaku yang sudah ada di halaman lain (mis. lama proses
// verifikasi 1×24 jam, sama dengan teks di app/verify/page.js).
export const HELP_CATEGORIES = [
  {
    id: "akun",
    label: "Akun & Profil",
    questions: [
      { id: "q1", question: "Bagaimana cara mengubah email atau nama akun saya?", answer: "Buka Pengaturan > Info Kontak, klik ikon pensil di kartu Akun, lalu ubah nama atau email dan simpan." },
      { id: "q2", question: "Kenapa email saya tampil tersensor di halaman Pengaturan?", answer: "Email disamarkan (mis. w******@gmail.com) sebagai pengaman tampilan. Kamu tetap bisa melihat dan mengubahnya lewat mode edit di kartu Akun." },
      { id: "q3", question: "Apa bedanya Profil Saya dan Pengaturan Profil?", answer: "Profil Saya (/profile) adalah profil publik yang dilihat UMKM, lengkap dengan portofolio dan riwayat kerja. Pengaturan Profil mengatur visibilitas (publik/privat) dan bahasa profil." },
      { id: "q4", question: "Bagaimana cara menutup akun saya?", answer: "Tautan \"Tutup akun saya\" ada di kartu Akun pada halaman Pengaturan. Fitur ini belum tersedia di prototipe ini." },
    ],
  },
  {
    id: "pembayaran",
    label: "Pembayaran & Penarikan",
    questions: [
      { id: "q5", question: "Bagaimana cara menarik dana escrow yang sudah disetujui?", answer: "Dana dari milestone yang disetujui klien otomatis masuk ke saldo Penghasilan. Buka Penghasilan > Penarikan Dana, pilih rekening tersimpan, lalu ajukan penarikan." },
      { id: "q6", question: "Berapa lama proses penarikan dana?", answer: "Penarikan biasanya diproses dalam 3 hari kerja setelah diajukan, tergantung metode pembayaran yang dipilih." },
      { id: "q7", question: "Kenapa ada potongan biaya platform?", answer: "Digital.in mengenakan biaya layanan 10% dari tiap termin yang dibayarkan, untuk operasional dan jaminan escrow." },
      { id: "q8", question: "Bagaimana cara menambah atau mengganti rekening penarikan?", answer: "Buka Pengaturan > Penarikan Dana, lalu klik \"Tambah rekening\" untuk menambahkan metode baru." },
      { id: "q8b", question: "Bagaimana cara mengatur metode pembayaran untuk akun UMKM?", answer: "Buka Pengaturan > Tagihan & Pembayaran. Di sana kamu bisa menambah metode (Virtual Account, kartu, atau e-wallet), memilih metode default, dan menghapus yang tidak dipakai. Pembayaran ke freelancer baru dipotong dari metode default saat proyek dimulai dan ditahan di escrow." },
    ],
  },
  {
    id: "proyek",
    label: "Proyek & Kontrak",
    questions: [
      { id: "q9", question: "Apa itu dana escrow dan kenapa penting?", answer: "Escrow adalah dana proyek yang ditahan platform sampai milestone disetujui, supaya pembayaran ke freelancer terjamin dan UMKM tetap aman dari pekerjaan yang tidak selesai." },
      { id: "q10", question: "Bagaimana cara mengajukan revisi pada milestone?", answer: "Di halaman Proyek Saya, buka detail proyek dan pilih milestone yang ingin direvisi, lalu kirim catatan revisi ke freelancer atau klien." },
      { id: "q11", question: "Apa yang terjadi kalau proyek dibatalkan di tengah jalan?", answer: "Dana escrow untuk milestone yang belum disetujui akan ditinjau tim Verify & Trust sebelum dikembalikan atau dicairkan sesuai progres yang sudah dikerjakan." },
    ],
  },
  {
    id: "verifikasi",
    label: "Verifikasi Identitas",
    questions: [
      { id: "q12", question: "Berapa lama proses verifikasi identitas?", answer: "Proses verifikasi biasanya selesai dalam 1×24 jam setelah dokumen dikirim." },
      { id: "q13", question: "Dokumen apa yang dibutuhkan untuk verifikasi?", answer: "Mahasiswa perlu mengunggah KTM/KTP dan data NIM & kampus. UMKM perlu mengunggah NIB dan dokumen usaha." },
      { id: "q14", question: "Kenapa saya perlu verifikasi identitas?", answer: "Profil terverifikasi mendapat badge kepercayaan dan tampil lebih sering di hasil pencarian, baik untuk freelancer maupun UMKM." },
    ],
  },
  {
    id: "keamanan",
    label: "Keamanan",
    questions: [
      { id: "q15", question: "Bagaimana cara mengaktifkan verifikasi dua langkah?", answer: "Buka Pengaturan > Kata Sandi & Keamanan, lalu aktifkan toggle Verifikasi Dua Langkah untuk meminta kode tambahan saat masuk dari perangkat baru." },
      { id: "q16", question: "Saya lupa kata sandi, apa yang harus dilakukan?", answer: "Gunakan tautan \"Lupa kata sandi\" di halaman masuk untuk mengatur ulang kata sandi lewat email terdaftar." },
      { id: "q16b", question: "Apa itu tim Verify & Trust dan kapan mereka turun tangan?", answer: "Verify & Trust adalah tim internal Digital.in yang meninjau verifikasi identitas, memantau dana escrow, dan menangani laporan. Mereka turun tangan saat ada laporan dari UMKM atau freelancer — dana milestone terkait bisa dibekukan sementara sampai peninjauan selesai, dan kedua pihak dihubungi sebelum ada keputusan." },
      { id: "q17", question: "Bagaimana cara keluar dari perangkat lain?", answer: "Buka Pengaturan > Kata Sandi & Keamanan > Perangkat Aktif, lalu klik \"Keluar\" pada perangkat yang tidak kamu kenali." },
    ],
  },
];
