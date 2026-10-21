// Helper format angka/tanggal — dipakai di halaman "Proyek Saya" dan
// bisa dipakai ulang di layar lain yang butuh format Rupiah/tanggal Indonesia.

export function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

// Sisa hari sampai tenggat, relatif ke `todayIso`. Tone dipakai buat warna
// petunjuk: netral, kuning (≤3 hari), merah (sudah lewat).
export function sisaHari(deadlineIso, todayIso) {
  const DAY = 24 * 60 * 60 * 1000;
  const diff = Math.round((new Date(deadlineIso) - new Date(todayIso)) / DAY);
  if (diff < 0) return { label: `Lewat ${-diff} hari`, tone: "danger" };
  if (diff === 0) return { label: "Hari ini", tone: "danger" };
  if (diff <= 3) return { label: `${diff} hari lagi`, tone: "warning" };
  return { label: `${diff} hari lagi`, tone: "neutral" };
}

// 12400000 -> "Rp12,4 jt", 850000 -> "Rp850 rb" — angka ringkas untuk
// statistik (mis. total penghasilan di halaman Cari Freelancer).
export function formatRupiahShort(n) {
  if (n >= 1000000) return `Rp${(n / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (n >= 1000) return `Rp${Math.round(n / 1000)} rb`;
  return `Rp${n}`;
}

export function formatTanggal(iso) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

// "Ratna Sulistiowati" -> "R**** S**********" — huruf pertama tiap kata
// tetap kelihatan. Dipakai Pengaturan > Info Saya (UMKM) untuk nama pemilik.
export function maskName(name) {
  return (name || "").split(" ").map((w) => (w ? w[0] + "*".repeat(Math.max(w.length - 1, 0)) : w)).join(" ");
}

// "nadia.putri@gmail.com" -> "n*********i@gmail.com" — dipakai halaman
// Pengaturan (card Akun) supaya email nggak tampil penuh, gaya "w******@
// gmail.com" di referensi Upwork. Karakter pertama & terakhir lokal-part
// tetap kelihatan biar pemiliknya masih bisa mengenali akunnya sendiri.
export function maskEmail(email) {
  const [local, domain] = (email || "").split("@");
  if (!local || !domain) return email || "";
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}
