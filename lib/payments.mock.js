// Data dummy khusus sisi UMKM untuk halaman "Pembayaran" (/payments).
// Sengaja TIDAK menyimpan status dana / nominal / tanggal transaksi —
// semua itu dihitung lib/payments.js dari lib/escrow.js (sumber yang sama
// dengan Penghasilan mahasiswa & Transaksi & Dana Verify & Trust). File ini
// cuma berisi hal yang memang hanya dimiliki UMKM: biaya layanan, metode
// pembayaran tersimpan, metode mana yang dipakai mendanai tiap termin, dan
// riwayat top-up saldo deposit.

// Biaya layanan yang dibayar UMKM di atas nilai termin. Beda dengan
// PLATFORM_FEE (10%, lib/earnings.mock.js) yang dipotong dari sisi
// mahasiswa — nilai terminnya sendiri tetap sama di ketiga sisi.
export const UMKM_SERVICE_FEE = 0.05;

export const PAYMENT_METHODS = [
  { id: "va-bca", type: "va", icon: "landmark", label: "Virtual Account BCA •••• 1102", holder: "Ratna Sulistiowati", isDefault: true },
  { id: "cc-mc", type: "kartu", icon: "wallet", label: "Kartu Kredit Mastercard •••• 8841", holder: "Ratna Sulistiowati" },
  { id: "gopay", type: "ewallet", icon: "send", label: "GoPay •••• 3390", holder: "Kopi Anteng" },
  { id: "deposit", type: "deposit", icon: "lock", label: "Saldo Deposit Digital.in", holder: "Kopi Anteng" },
];

// txId (`${projectId}-${milestoneId}`, format lib/escrow.js) -> metode yang
// dipakai UMKM saat mendanai termin itu ke escrow. Termin yang tidak ada di
// sini dianggap dibayar lewat Virtual Account BCA.
export const PAYMENT_SOURCE = {
  "mp1-m1": "va-bca",
  "pp1-m1": "cc-mc",
  "pp1-m2": "cc-mc",
  "pp2-m1": "deposit",
  "pp2-m2": "deposit",
  "pp2-m3": "deposit",
  "pp5-m1": "deposit",
  "pp6-m1": "va-bca",
  "pp7-m1": "gopay",
  "pp8-m1": "va-bca",
  "pp8-m2": "va-bca",
  "pp9-m1": "gopay",
};

// Dipakai Pengaturan > Tagihan & Pembayaran (components/settings/
// BillingPanel.js). Alamat sengaja sama dengan alamat usaha di Info Saya
// (lib/users.mock.js, contact.address).
export const BILLING_ADDRESS = {
  businessName: "Kopi Anteng",
  address: "Jl. Fatmawati No. 24",
  city: "Jakarta Selatan",
  postalCode: "12150",
};

// autoRelease: preferensi tampilan saja — lib/escrow.js belum punya aturan
// pencairan otomatis, jadi nilai ini belum mengubah status dana.
export const PAYMENT_PREFERENCES = { autoRelease: false };

export const DEPOSIT_TOPUPS = [
  { id: "tu1", date: "2026-08-25", amount: 1000000, methodId: "va-bca" },
  { id: "tu2", date: "2026-09-01", amount: 1500000, methodId: "va-bca" },
];
