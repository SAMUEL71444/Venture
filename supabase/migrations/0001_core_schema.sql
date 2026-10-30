-- ============================================================================
-- CP1 — Skema Database Inti (Digital.in di Supabase)
-- ============================================================================
-- Tabel fondasi: profil pengguna (UMKM/mahasiswa/mentor/admin), universitas,
-- kategori jasa, dan platform_settings (angka bisnis).
--
-- Catatan desain:
--   * Supabase Auth sudah menyediakan tabel auth.users. Kita TIDAK membuat
--     tabel user sendiri; kita buat tabel `profiles` yang id-nya = auth.users.id.
--   * Uang (nanti di CP5) disimpan BIGINT Rupiah. Belum ada di migration ini.
--   * RLS diaktifkan; policy minimal dulu, diperketat di checkpoint berikutnya.
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------- Enum tipe ----------
do $$ begin
  create type user_role as enum ('umkm', 'mahasiswa', 'mentor', 'trust');
exception when duplicate_object then null; end $$;

do $$ begin
  create type account_status as enum ('pending', 'active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'belum' = belum mengajukan; 'pending' = sudah mengajukan, menunggu tinjau
  create type verification_status as enum ('belum', 'pending', 'terverifikasi', 'ditolak');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skill_level as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

-- ---------- Fungsi util: auto-update kolom updated_at ----------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- profiles — satu baris per pengguna, 1:1 dengan auth.users
-- ============================================================================
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null,
  full_name     text not null default '',
  -- untuk UMKM: nama usaha. untuk mahasiswa/mentor/admin: nama orang.
  display_name  text not null default '',
  phone         text,
  avatar_url    text,
  status        account_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- universities — katalog kampus (untuk form daftar mahasiswa & cocok email)
-- ============================================================================
create table if not exists universities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  -- subdomain email kampus, mis. 'ui.ac.id' (untuk verifikasi email kampus)
  email_domain  text,
  city          text,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- student_profiles — data tambahan khusus mahasiswa (1:1 dengan profiles)
-- ============================================================================
create table if not exists student_profiles (
  profile_id        uuid primary key references profiles(id) on delete cascade,
  university_id     uuid references universities(id),
  university_name   text,                         -- fallback bila input manual
  nim               text,
  major             text,
  bio               text,
  city              text,
  skills            jsonb not null default '[]',  -- [{name, level}]
  hourly_rate       bigint,                       -- Rupiah
  rating_avg        numeric(3,2) not null default 0,
  completed_count   integer not null default 0,
  ktm_verification  verification_status not null default 'belum',
  ktm_file_path     text,                         -- path di bucket privat
  campus_email      text,
  campus_email_verified boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_student_updated on student_profiles;
create trigger trg_student_updated before update on student_profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- umkm_profiles — data tambahan khusus UMKM (1:1 dengan profiles)
-- ============================================================================
create table if not exists umkm_profiles (
  profile_id      uuid primary key references profiles(id) on delete cascade,
  business_type   text,
  owner_name      text,
  business_size   text,
  city            text,
  address         text,
  npwp            text,
  nib             text,
  verification    verification_status not null default 'belum',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_umkm_updated on umkm_profiles;
create trigger trg_umkm_updated before update on umkm_profiles
  for each row execute function set_updated_at();

-- ============================================================================
-- service_categories — kategori jasa (Social Media, Branding, Website, dll)
-- ============================================================================
create table if not exists service_categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  description   text,
  sort_order    integer not null default 0
);

-- ============================================================================
-- platform_settings — angka bisnis (key-value), bisa diubah tanpa deploy
-- ============================================================================
create table if not exists platform_settings (
  key           text primary key,
  value         text not null,
  description   text,
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_settings_updated on platform_settings;
create trigger trg_settings_updated before update on platform_settings
  for each row execute function set_updated_at();

-- ============================================================================
-- Row Level Security (RLS) — fondasi
-- ============================================================================
alter table profiles          enable row level security;
alter table student_profiles   enable row level security;
alter table umkm_profiles      enable row level security;
alter table universities       enable row level security;
alter table service_categories enable row level security;
alter table platform_settings  enable row level security;

-- profiles: setiap orang boleh baca profil (untuk tampil publik mahasiswa/umkm),
-- tetapi hanya pemilik yang boleh ubah barisnya sendiri.
drop policy if exists "profiles baca publik" on profiles;
create policy "profiles baca publik" on profiles
  for select using (true);

drop policy if exists "profiles ubah milik sendiri" on profiles;
create policy "profiles ubah milik sendiri" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles insert milik sendiri" on profiles;
create policy "profiles insert milik sendiri" on profiles
  for insert with check (auth.uid() = id);

-- student_profiles & umkm_profiles: baca publik, tulis hanya pemilik.
drop policy if exists "student baca publik" on student_profiles;
create policy "student baca publik" on student_profiles for select using (true);
drop policy if exists "student tulis milik sendiri" on student_profiles;
create policy "student tulis milik sendiri" on student_profiles
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "umkm baca publik" on umkm_profiles;
create policy "umkm baca publik" on umkm_profiles for select using (true);
drop policy if exists "umkm tulis milik sendiri" on umkm_profiles;
create policy "umkm tulis milik sendiri" on umkm_profiles
  for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

-- universities, service_categories, platform_settings: baca untuk semua
-- (termasuk anon, karena form daftar perlu daftar kampus & kategori).
drop policy if exists "universities baca semua" on universities;
create policy "universities baca semua" on universities for select using (true);

drop policy if exists "kategori baca semua" on service_categories;
create policy "kategori baca semua" on service_categories for select using (true);

drop policy if exists "settings baca semua" on platform_settings;
create policy "settings baca semua" on platform_settings for select using (true);
