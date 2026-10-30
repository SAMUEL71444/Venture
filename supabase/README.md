# Back End Supabase — Digital.in

Folder ini berisi back end aplikasi yang dibangun di atas **Supabase**
(Postgres + Auth + Storage + Edge Functions), menggantikan back end Laravel.

## Struktur

```
supabase/
  migrations/   # Skema database (SQL) — dijalankan berurutan sesuai nama file
  functions/    # Edge Functions (TypeScript) — logika sensitif, terutama KEUANGAN
  seed/         # Data awal (platform_settings, kategori, universitas)
```

## Prinsip

- **Uang disimpan sebagai BIGINT Rupiah** (bukan desimal/float).
- **Logika keuangan hanya di Edge Functions** dengan transaksi Postgres
  (atomic + row lock), tidak pernah di front-end.
- **Row Level Security (RLS) aktif** di semua tabel berisi data pengguna.
- **Angka bisnis** (komisi, batas revisi, timeout) ada di tabel
  `platform_settings` agar bisa diubah tanpa deploy ulang.

## Status Migrasi

Dikerjakan per checkpoint (lihat master plan). Checkpoint saat ini: **CP0 — Fondasi & Setup**.

- [x] CP0 — Fondasi & setup (branch, library, koneksi, struktur folder)
- [ ] CP1 — Skema database inti
- [ ] CP2 — Auth + profil + verifikasi KTM
- [ ] CP3 — Proyek + template + kategori
- [ ] CP4 — Lamaran + kontrak + milestone
- [ ] CP5 — Keuangan: ledger + escrow
- [ ] CP6 — Mentor review + batas revisi
- [ ] CP7 — Payout + sertifikat + rating + chat
- [ ] CP8 — Scheduler
- [ ] CP9 — Deploy ke Vercel
