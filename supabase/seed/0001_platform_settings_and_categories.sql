-- ============================================================================
-- CP1 — Seed: platform_settings & service_categories
-- Angka diambil dari dokumen desain temanmu (06-alur-keuangan & README backend).
-- Aman dijalankan berulang (upsert).
-- ============================================================================

insert into platform_settings (key, value, description) values
  ('platform_fee_pct',            '12',    'Komisi platform dari nilai milestone (persen)'),
  ('mentor_share_pct',            '30',    'Porsi mentor dari komisi platform (persen)'),
  ('mentor_min_fee',              '10000', 'Fee minimum mentor per milestone (Rupiah)'),
  ('min_milestone_amount',        '150000','Nilai minimum per milestone (Rupiah)'),
  ('max_revisions_per_milestone', '2',     'Maks revisi UMKM per milestone'),
  ('max_mentor_returns_per_milestone','3', 'Maks pengembalian mentor per milestone'),
  ('max_active_contracts_per_student','2', 'Maks kontrak aktif per mahasiswa'),
  ('min_withdrawal_amount',       '20000', 'Minimum penarikan saldo (Rupiah)'),
  ('premium_listing_price',       '50000', 'Harga premium listing (Rupiah)'),
  ('premium_listing_days',        '30',    'Durasi premium listing (hari)'),
  ('payment_expiry_hours',        '24',    'Batas waktu pembayaran tagihan (jam)'),
  ('matching_default_rating',     '3.5',   'Rating default mahasiswa baru di smart matching')
on conflict (key) do update
  set value = excluded.value, description = excluded.description;

insert into service_categories (slug, name, description, sort_order) values
  ('social-media',   'Social Media',      'Konten feed & reels, kelola media sosial', 1),
  ('branding',       'Branding',          'Logo & panduan merek',                      2),
  ('website',        'Website',           'Website profil usaha & toko online',        3),
  ('marketplace',    'Marketplace',       'Setup & optimasi Shopee/Tokopedia',         4),
  ('bookkeeping',    'Digital Bookkeeping','Pembukuan & laporan keuangan',             5),
  ('graphic-design', 'Graphic Design',    'Desain menu, banner, materi promosi',       6)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;
