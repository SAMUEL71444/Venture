-- ============================================================================
-- CP3 — Proyek + Template
-- ============================================================================
-- Proyek yang diposting UMKM. Lamaran, kontrak, dan milestone menyusul di CP4.
-- ============================================================================

do $$ begin
  create type project_status as enum ('open', 'assigned', 'in_progress', 'completed', 'cancelled', 'closed');
exception when duplicate_object then null; end $$;

-- ---------- project_templates (kerangka kebutuhan + milestone default) ----------
create table if not exists project_templates (
  id              uuid primary key default gen_random_uuid(),
  category_id     uuid references service_categories(id),
  title           text not null,
  description     text,
  default_milestones jsonb not null default '[]',  -- [{name, pct}]
  created_at      timestamptz not null default now()
);

-- ---------- projects ----------
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  umkm_id         uuid not null references profiles(id) on delete cascade,
  template_id     uuid references project_templates(id),
  category_id     uuid references service_categories(id),
  title           text not null,
  description     text not null default '',
  budget          bigint not null default 0,       -- Rupiah
  deadline        date,
  location        text,                            -- mis. "Jakarta (Remote)"
  status          project_status not null default 'open',
  is_premium      boolean not null default false,
  premium_until   timestamptz,
  applicants_count integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_projects_status on projects(status);
create index if not exists idx_projects_umkm on projects(umkm_id);
create index if not exists idx_projects_category on projects(category_id);

drop trigger if exists trg_projects_updated on projects;
create trigger trg_projects_updated before update on projects
  for each row execute function set_updated_at();

-- ---------- RLS ----------
alter table project_templates enable row level security;
alter table projects          enable row level security;

-- Template: baca untuk semua (form posting butuh).
drop policy if exists "template baca semua" on project_templates;
create policy "template baca semua" on project_templates for select using (true);

-- Projects:
--  * baca: proyek berstatus 'open' terlihat semua orang; pemilik selalu lihat
--    proyeknya sendiri apa pun statusnya.
drop policy if exists "projects baca open atau milik" on projects;
create policy "projects baca open atau milik" on projects
  for select using (status = 'open' or umkm_id = auth.uid());

--  * tulis: hanya UMKM pemilik. Insert harus atas nama diri sendiri.
drop policy if exists "projects insert milik umkm" on projects;
create policy "projects insert milik umkm" on projects
  for insert with check (
    umkm_id = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'umkm')
  );

drop policy if exists "projects update milik umkm" on projects;
create policy "projects update milik umkm" on projects
  for update using (umkm_id = auth.uid()) with check (umkm_id = auth.uid());

drop policy if exists "projects delete milik umkm" on projects;
create policy "projects delete milik umkm" on projects
  for delete using (umkm_id = auth.uid());
