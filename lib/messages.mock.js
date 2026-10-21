// Data dummy halaman "Pesan". Tiap percakapan terikat ke `projectId` yang
// sudah ada di lib/projects.mock.js — isi chatnya sengaja mengikuti histori
// event proyek itu (kirim milestone, revisi, dst) biar ceritanya nyambung.
// `read`/`status` di sini yang jadi sumber jumlah "belum dibaca", bukan
// angka yang diketik manual — lihat lib/chat.js (unreadCount).

export const CONVERSATIONS = [
  {
    id: "conv-mp1",
    projectId: "mp1",
    contact: { name: "Ratna Sulistiowati", avatarBg: "#F0E3E0", online: true, lastSeen: null },
    messages: [
      { id: "mp1-1", from: "them", text: "Halo Nadia! Makasih ya udah setuju bantu Kopi Anteng bulan ini 😊", at: "2026-09-01T09:15", read: true },
      { id: "mp1-2", from: "me", text: "Halo kak Ratna! Siap, saya mulai riset dulu buat moodboard-nya ya", at: "2026-09-01T09:20", status: "dibaca" },
      { id: "mp1-3", from: "me", text: "Kak, moodboard & kalender kontennya udah saya kirim di proyek ya, boleh dicek", at: "2026-09-03T14:02", status: "dibaca", attachment: { name: "moodboard-kopi-anteng.pdf" } },
      { id: "mp1-4", from: "them", text: "Udah aku cek, bagus banget! Lanjut aja ke tahap berikutnya", at: "2026-09-04T08:30", read: true },
      { id: "mp1-5", from: "me", text: "Batch 1 (6 desain feed) udah kelar, aku upload ya", at: "2026-09-08T16:45", status: "dibaca", attachment: { name: "feed-batch-1.zip" } },
      { id: "mp1-6", from: "them", text: "Wah cakep-cakep! Approved, lanjut batch 2 ya", at: "2026-09-09T09:10", read: true },
      { id: "mp1-7", from: "me", text: "Draf batch 2 udah aku upload, mohon dicek dulu sebelum aku lanjut ke reels", at: "2026-09-14T11:30", status: "dibaca", attachment: { name: "feed-batch-2-draft.zip" } },
      { id: "mp1-8", from: "them", text: "Kelihatannya oke, tapi warnanya boleh dibikin lebih hangat nggak? Biar sesuai vibe kedai", at: "2026-09-15T08:05", read: false },
    ],
  },
  {
    id: "conv-mp2",
    projectId: "mp2",
    contact: { name: "Pak Darmawan", avatarBg: "#DDEDE3", online: false, lastSeen: "2026-09-15T09:40" },
    messages: [
      { id: "mp2-1", from: "them", text: "Selamat siang, saya Darmawan dari Batik Asri Nusantara. Ditunggu progresnya ya dek", at: "2026-08-25T10:00", read: true },
      { id: "mp2-2", from: "me", text: "Siang pak, riset merek & moodboard udah saya kirim", at: "2026-08-28T15:20", status: "dibaca", attachment: { name: "riset-batik-asri.pdf" } },
      { id: "mp2-3", from: "them", text: "Sudah saya lihat, oke lanjut ke konsep logo", at: "2026-08-29T09:00", read: true },
      { id: "mp2-4", from: "me", text: "Konsep logo v1 sudah saya kirim pak", at: "2026-09-04T13:10", status: "dibaca", attachment: { name: "konsep-logo-v1.pdf" } },
      { id: "mp2-5", from: "them", text: "Motif parang-nya kurang tegas menurut saya, bisa dipertajam lagi?", at: "2026-09-05T10:45", read: true },
      { id: "mp2-6", from: "me", text: "Sudah saya revisi pak, motif parangnya saya perjelas", at: "2026-09-07T14:00", status: "dibaca", attachment: { name: "konsep-logo-v2.pdf" } },
      { id: "mp2-7", from: "them", text: "Nah ini pas! Lanjut ke logo final ya", at: "2026-09-08T09:30", read: true },
      { id: "mp2-8", from: "me", text: "Logo final sudah saya kirim pak", at: "2026-09-11T16:00", status: "dibaca", attachment: { name: "logo-final.ai" } },
      { id: "mp2-9", from: "me", text: "Brand guideline ringkasnya juga sudah saya kirim, mohon direview ya pak", at: "2026-09-15T10:12", status: "terkirim", attachment: { name: "brand-guideline-batik-asri.pdf" } },
    ],
  },
  {
    id: "conv-mp3",
    projectId: "mp3",
    contact: { name: "Ibu Tini", avatarBg: "#F5E5D9", online: true, lastSeen: null },
    messages: [
      { id: "mp3-1", from: "them", text: "Halo, tokonya udah mulai disetup ya?", at: "2026-09-02T08:00", read: true },
      { id: "mp3-2", from: "me", text: "Sudah bu, saya mulai bikin akun & profil tokonya dulu", at: "2026-09-02T08:15", status: "dibaca" },
      { id: "mp3-3", from: "them", text: "Oke makasih, lanjut aja", at: "2026-09-04T10:00", read: true },
      { id: "mp3-4", from: "me", text: "25 produk udah saya unggah semua bu", at: "2026-09-08T15:30", status: "dibaca", attachment: { name: "data-produk-25-item.xlsx" } },
      { id: "mp3-5", from: "them", text: "Mantap, makasih ya", at: "2026-09-09T09:00", read: true },
      { id: "mp3-6", from: "me", text: "Judul & foto produknya udah saya optimasi, ini hasilnya", at: "2026-09-12T11:20", status: "dibaca", attachment: { name: "foto-produk-edit.zip" } },
      { id: "mp3-7", from: "them", text: "Bu Tini lihat-lihat lagi, kayaknya judul & foto buat 8 produk masih kurang menarik. Bisa diperbaiki lagi?", at: "2026-09-14T09:40", read: false },
    ],
  },
  {
    id: "conv-mp4",
    projectId: "mp4",
    contact: { name: "Hendra Wibowo", avatarBg: "#DEE7F2", online: false, lastSeen: "2026-09-14T18:00" },
    messages: [
      { id: "mp4-1", from: "them", text: "Selamat pagi, saya Hendra dari Berkah Furniture", at: "2026-09-05T09:00", read: true },
      { id: "mp4-2", from: "me", text: "Pagi pak, sitemap & wireframe websitenya sudah saya kirim", at: "2026-09-07T11:00", status: "dibaca", attachment: { name: "wireframe.fig" } },
      { id: "mp4-3", from: "them", text: "Sudah saya lihat, strukturnya oke. Lanjut ke desain ya", at: "2026-09-09T10:15", read: true },
      { id: "mp4-4", from: "me", text: "Desain halaman beranda udah saya buat, ini previewnya", at: "2026-09-13T14:50", status: "dibaca", attachment: { name: "desain-beranda.fig" } },
      { id: "mp4-5", from: "them", text: "Wah keren! Warnanya udah pas sama identitas Berkah Furniture", at: "2026-09-13T17:20", read: true },
      { id: "mp4-6", from: "me", text: "Makasih pak, nanti saya lanjut ke halaman produk & katalog", at: "2026-09-14T09:00", status: "dibaca" },
    ],
  },
  {
    id: "conv-mp5",
    projectId: "mp5",
    contact: { name: "Mas Agus", avatarBg: "#E4EEDC", online: false, lastSeen: "2026-09-12T20:15" },
    messages: [
      { id: "mp5-1", from: "them", text: "Laporan laba ruginya udah beres ya? Makasih banyak", at: "2026-08-20T15:00", read: true },
      { id: "mp5-2", from: "me", text: "Sudah pak, semua udah saya kirim dan disetujui", at: "2026-08-20T15:10", status: "dibaca" },
      { id: "mp5-3", from: "them", text: "Oke sip, nanti kalau butuh laporan bulan berikutnya boleh hubungi kamu lagi?", at: "2026-08-21T09:00", read: true },
      { id: "mp5-4", from: "me", text: "Boleh banget pak, kabari aja kalau butuh", at: "2026-08-21T09:15", status: "dibaca" },
      { id: "mp5-5", from: "them", text: "Eh iya, laundry-nya makin rame nih semenjak pembukuannya rapi", at: "2026-08-25T10:00", read: true },
      { id: "mp5-6", from: "me", text: "Alhamdulillah, seneng dengernya pak", at: "2026-08-25T10:05", status: "dibaca" },
      { id: "mp5-7", from: "them", text: "Halo, jadi gimana nih buat laporan bulan September? Masih available?", at: "2026-09-10T14:00", read: false },
    ],
  },
  {
    id: "conv-mp8",
    projectId: "mp8",
    contact: { name: "Bu Yuli", avatarBg: "#EADFF0", online: false, lastSeen: "2026-09-03T07:00" },
    messages: [
      { id: "mp8-1", from: "me", text: "Bu, file siap cetak kemasannya udah saya kirim ya", at: "2026-08-31T16:00", status: "dibaca", attachment: { name: "file-cetak-cmyk.zip" } },
      { id: "mp8-2", from: "them", text: "Sudah saya cek, bagus banget hasilnya!", at: "2026-09-01T08:30", read: true },
      { id: "mp8-3", from: "them", text: "Makasih banyak ya udah bantu dari awal sampai akhir 🙏", at: "2026-09-01T08:32", read: true },
      { id: "mp8-4", from: "me", text: "Sama-sama bu, senang bisa bantu. Semoga kemasan barunya laris manis!", at: "2026-09-01T08:40", status: "dibaca" },
      { id: "mp8-5", from: "them", text: "Aamiin! Kemasannya udah mulai naik cetak nih", at: "2026-09-02T10:00", read: true },
      { id: "mp8-6", from: "me", text: "Wah mantap bu, semoga sambalnya makin laku 🌶️", at: "2026-09-02T10:05", status: "dibaca" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Percakapan dari sudut pandang UMKM (Kopi Anteng): "me" = pemilik usaha
// (Ratna), "them" = freelancer. Satu thread per proyek `pp*` yang punya
// freelancer — isinya mengikuti log event proyek itu (lib/platform-
// projects.mock.js) supaya ceritanya nyambung dengan status di kartu proyek.
// Proyek mp1 TIDAK ditulis ulang di sini: percakapannya diambil dari
// CONVERSATIONS (sudut pandang Nadia) lalu dibalik oleh lib/chat.js
// (flipConversation), jadi kedua sisi selalu menceritakan hal yang sama.
// Daftar percakapan UMKM diturunkan dari relasi proyek (buildUmkmConversations
// di lib/chat.js), bukan dari daftar statis ini — file ini hanya isi chatnya.
// ---------------------------------------------------------------------------
export const UMKM_THREADS = {
  pp1: {
    online: true, lastSeen: null,
    messages: [
      { id: "pp1-1", from: "them", text: "Halo Bu Ratna, saya Farhan. Saya mulai dari riset merek dan moodboard dulu ya", at: "2026-09-05T09:10", read: true },
      { id: "pp1-2", from: "me", text: "Halo Farhan, siap. Referensi rasa dan warna yang kami suka sudah ada di brief ya", at: "2026-09-05T09:25", status: "dibaca" },
      { id: "pp1-3", from: "them", text: "Moodboard sudah saya kirim di proyek, mohon dicek Bu", at: "2026-09-08T14:00", read: true, attachment: { name: "moodboard-kopi-anteng.pdf" } },
      { id: "pp1-4", from: "me", text: "Sudah saya lihat, arahnya pas. Lanjut ke konsep logo ya", at: "2026-09-09T10:15", status: "dibaca" },
      { id: "pp1-5", from: "them", text: "Konsep logo v1 sudah saya upload, ada 3 opsi. Kabari opsi mana yang paling cocok ya Bu", at: "2026-09-14T16:20", read: false, attachment: { name: "konsep-logo-v1.pdf" } },
    ],
  },
  pp2: {
    online: false, lastSeen: "2026-09-14T21:30",
    messages: [
      { id: "pp2-1", from: "me", text: "Mas Bagas, tolong mulai dari setup akun dan profil toko Shopee-nya dulu ya", at: "2026-08-28T09:00", status: "dibaca" },
      { id: "pp2-2", from: "them", text: "Setup akun dan profil toko sudah selesai Bu, saya kirim untuk disetujui", at: "2026-08-30T15:10", read: true },
      { id: "pp2-3", from: "me", text: "Disetujui, lanjut unggah produknya", at: "2026-08-31T08:40", status: "dibaca" },
      { id: "pp2-4", from: "them", text: "20 produk sudah terunggah lengkap dengan judul dan foto yang saya optimasi", at: "2026-09-06T17:00", read: true, attachment: { name: "data-produk-20-item.xlsx" } },
      { id: "pp2-5", from: "me", text: "Mantap, disetujui. Terima kasih Mas", at: "2026-09-07T09:30", status: "dibaca" },
      { id: "pp2-6", from: "them", text: "Laporan akhir sudah saya kirim Bu. Mohon direview supaya milestone terakhir bisa dicairkan", at: "2026-09-14T20:45", read: false, attachment: { name: "laporan-akhir-shopee.pdf" } },
    ],
  },
  pp5: {
    online: true, lastSeen: null,
    messages: [
      { id: "pp5-1", from: "me", text: "Mbak Dewi, nota kas Agustus untuk dua cabang ada di folder bersama ya", at: "2026-09-02T09:05", status: "dibaca" },
      { id: "pp5-2", from: "them", text: "Siap Bu, saya rekap dulu nota dan kas Agustusnya", at: "2026-09-02T10:20", read: true },
      { id: "pp5-3", from: "them", text: "Rekap kas Agustus sudah selesai, saya kirim ya Bu", at: "2026-09-11T13:00", read: true, attachment: { name: "rekap-kas-agustus.xlsx" } },
      { id: "pp5-4", from: "me", text: "Sudah saya cek dan disetujui. Lanjut template laporan bulanannya ya", at: "2026-09-13T08:50", status: "dibaca" },
      { id: "pp5-5", from: "them", text: "Baik Bu. Untuk template-nya, kolom pengeluaran mau dipisah per cabang atau digabung?", at: "2026-09-14T11:05", read: false },
    ],
  },
  pp6: {
    online: false, lastSeen: "2026-09-14T19:10",
    messages: [
      { id: "pp6-1", from: "me", text: "Mas Rangga, mockup final sudah ada di brief. Mohon warna dan tata letak mengikuti itu ya", at: "2026-09-03T09:00", status: "dibaca" },
      { id: "pp6-2", from: "them", text: "Siap Bu, saya mulai dari halaman utamanya", at: "2026-09-03T09:40", read: true },
      { id: "pp6-3", from: "them", text: "Versi pertama landing page sudah saya kirim", at: "2026-09-10T18:00", read: true, attachment: { name: "landing-promo-v1.zip" } },
      { id: "pp6-4", from: "me", text: "Mas, tata letak dan warnanya berbeda dari mockup. Tolong disesuaikan ya", at: "2026-09-12T10:30", status: "dibaca" },
      { id: "pp6-5", from: "them", text: "Menurut saya sudah sesuai Bu, tapi saya cek lagi mockup-nya", at: "2026-09-13T09:15", read: true },
      { id: "pp6-6", from: "me", text: "Saya sudah laporkan ke tim Verify & Trust supaya ditinjau bersama, dananya ditahan dulu ya", at: "2026-09-13T15:00", status: "dibaca" },
      { id: "pp6-7", from: "them", text: "Baik Bu, saya tunggu hasil peninjauannya dan siap kirim file final", at: "2026-09-14T19:00", read: false },
    ],
  },
  pp7: {
    online: false, lastSeen: "2026-08-20T17:30",
    messages: [
      { id: "pp7-1", from: "me", text: "Mbak Kirana, kita mulai dari storyboard video menu baru ya", at: "2026-08-10T09:00", status: "dibaca" },
      { id: "pp7-2", from: "them", text: "Storyboard sudah saya kirim Bu", at: "2026-08-15T14:30", read: true, attachment: { name: "storyboard-menu-baru.pdf" } },
      { id: "pp7-3", from: "me", text: "Bagus, tapi peluncuran menu barunya diundur ke bulan depan", at: "2026-08-18T10:00", status: "dibaca" },
      { id: "pp7-4", from: "me", text: "Maaf Mbak, proyeknya saya batalkan dulu. Nanti saya kabari kalau jadi dilanjutkan", at: "2026-08-20T09:30", status: "dibaca" },
      { id: "pp7-5", from: "them", text: "Tidak apa-apa Bu, terima kasih sudah dikabari. Kabari lagi kalau mau lanjut ya", at: "2026-08-20T17:30", read: true },
    ],
  },
  pp8: {
    online: false, lastSeen: "2026-09-10T08:00",
    messages: [
      { id: "pp8-u1", from: "me", text: "Mas Farhan, 25 produk kopi kemasan siap difoto minggu ini ya", at: "2026-06-02T09:00", status: "dibaca" },
      { id: "pp8-u2", from: "them", text: "Foto 25 produk sudah saya upload Bu", at: "2026-06-18T16:00", read: true, attachment: { name: "foto-produk-25-item.zip" } },
      { id: "pp8-u3", from: "me", text: "Hasilnya bagus sekali, disetujui", at: "2026-06-20T09:20", status: "dibaca" },
      { id: "pp8-u4", from: "them", text: "Menu digital dan QR untuk meja sudah jadi", at: "2026-07-06T15:00", read: true, attachment: { name: "menu-digital-qr.pdf" } },
      { id: "pp8-u5", from: "me", text: "Disetujui. Terima kasih banyak Mas, rapi sekali", at: "2026-07-08T10:00", status: "dibaca" },
      { id: "pp8-u6", from: "them", text: "Sama-sama Bu, senang bisa bantu Kopi Anteng", at: "2026-07-08T10:30", read: true },
    ],
  },
  pp9: {
    online: true, lastSeen: null,
    messages: [
      { id: "pp9-1", from: "me", text: "Mbak Dewi, kami butuh template pencatatan kasir harian dan stok bahan baku", at: "2026-04-06T09:00", status: "dibaca" },
      { id: "pp9-2", from: "them", text: "Template kasir dan stok sudah saya kirim Bu", at: "2026-04-25T14:00", read: true, attachment: { name: "template-kasir-stok.xlsx" } },
      { id: "pp9-3", from: "me", text: "Sudah dipakai kasir kami, mudah sekali. Disetujui, terima kasih", at: "2026-04-28T09:30", status: "dibaca" },
      { id: "pp9-4", from: "them", text: "Alhamdulillah. Kalau butuh laporan bulanan juga, kabari saja ya Bu", at: "2026-04-28T10:00", read: true },
    ],
  },
};
