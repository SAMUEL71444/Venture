-- ============================================================================
-- CP4 — Lamaran + Undangan + Kontrak + Milestone
-- ============================================================================
-- Alur: mahasiswa melamar proyek (usulan milestone) ATAU UMKM mengundang.
-- UMKM menerima lamaran → kontrak dibuat (status awaiting_payment) + milestone.
-- Uang/escrow belum disentuh di sini (itu CP5); status diubah manual dulu.
-- ============================================================================

-- ---------- Enum status ----------
do $$ begin
  create type application_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending', 'accepted', 'declined', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type contract_status as enum (
    'awaiting_payment', 'funded', 'in_progress',
    'cancellation_requested', 'completed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type milestone_status as enum (
    'locked', 'in_progress', 'submitted', 'in_review',
    'revision', 'approved', 'cancelled', 'escalated'
  );
exception when duplicate_object then null; end $$;

-- ---------- applications (lamaran mahasiswa) ----------
create table if not exists applications (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  student_id      uuid not null references profiles(id) on delete cascade,
  proposal        text not null default '',
  bid_amount      bigint not null default 0,            -- total usulan (Rupiah)
  proposed_milestones jsonb not null default '[]',      -- [{name, amount}]
  match_score     integer,                              -- 0..100 (smart matching)
  status          application_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Satu mahasiswa hanya boleh melamar sekali per proyek.
  unique (project_id, student_id)
);
create index if not exists idx_app_project on applications(project_id);
create index if not exists idx_app_student on applications(student_id);

drop trigger if exists trg_app_updated on applications;
create trigger trg_app_updated before update on applications
  for each row execute function set_updated_at();

-- ---------- invitations (UMKM mengundang mahasiswa) ----------
create table if not exists invitations (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  student_id      uuid not null references profiles(id) on delete cascade,
  message         text,
  status          invitation_status not null default 'pending',
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (project_id, student_id)
);
create index if not exists idx_inv_student on invitations(student_id);

-- ---------- contracts (kesepakatan final) ----------
create table if not exists contracts (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete restrict,
  umkm_id         uuid not null references profiles(id) on delete restrict,
  student_id      uuid not null references profiles(id) on delete restrict,
  application_id  uuid references applications(id),
  total_amount    bigint not null,                      -- nilai proyek (Rupiah)
  -- snapshot persentase komisi SAAT kontrak dibuat (meniru desain asli:
  -- perubahan setting tidak memengaruhi kontrak berjalan)
  platform_fee_pct  integer not null,
  mentor_share_pct  integer not null,
  status          contract_status not null default 'awaiting_payment',
  contract_no     text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Satu proyek hanya punya satu kontrak aktif (bukan cancelled/completed).
  unique (project_id)
);
create index if not exists idx_contract_student on contracts(student_id);
create index if not exists idx_contract_umkm on contracts(umkm_id);

drop trigger if exists trg_contract_updated on contracts;
create trigger trg_contract_updated before update on contracts
  for each row execute function set_updated_at();

-- ---------- milestones ----------
create table if not exists milestones (
  id              uuid primary key default gen_random_uuid(),
  contract_id     uuid not null references contracts(id) on delete cascade,
  seq             integer not null,                     -- urutan 1,2,3...
  name            text not null,
  amount          bigint not null,                      -- Rupiah
  status          milestone_status not null default 'locked',
  revisions_used  integer not null default 0,
  mentor_returns_used integer not null default 0,
  due_date        date,
  started_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (contract_id, seq)
);
create index if not exists idx_milestone_contract on milestones(contract_id);

drop trigger if exists trg_milestone_updated on milestones;
create trigger trg_milestone_updated before update on milestones
  for each row execute function set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table applications enable row level security;
alter table invitations  enable row level security;
alter table contracts     enable row level security;
alter table milestones    enable row level security;

-- applications:
--  * mahasiswa lihat & buat lamaran sendiri; boleh tarik (update) miliknya.
--  * UMKM pemilik proyek lihat lamaran yang masuk ke proyeknya.
drop policy if exists "app baca milik terkait" on applications;
create policy "app baca milik terkait" on applications
  for select using (
    student_id = auth.uid()
    or exists (select 1 from projects pr where pr.id = project_id and pr.umkm_id = auth.uid())
  );

drop policy if exists "app insert mahasiswa" on applications;
create policy "app insert mahasiswa" on applications
  for insert with check (
    student_id = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'mahasiswa')
  );

drop policy if exists "app update terkait" on applications;
create policy "app update terkait" on applications
  for update using (
    student_id = auth.uid()
    or exists (select 1 from projects pr where pr.id = project_id and pr.umkm_id = auth.uid())
  );

-- invitations: UMKM pemilik proyek & mahasiswa yang diundang.
drop policy if exists "inv baca terkait" on invitations;
create policy "inv baca terkait" on invitations
  for select using (
    student_id = auth.uid()
    or exists (select 1 from projects pr where pr.id = project_id and pr.umkm_id = auth.uid())
  );
drop policy if exists "inv tulis umkm" on invitations;
create policy "inv tulis umkm" on invitations
  for all using (
    exists (select 1 from projects pr where pr.id = project_id and pr.umkm_id = auth.uid())
  ) with check (
    exists (select 1 from projects pr where pr.id = project_id and pr.umkm_id = auth.uid())
  );

-- contracts & milestones: hanya pihak terkait (UMKM atau mahasiswa kontrak itu).
drop policy if exists "contract baca terkait" on contracts;
create policy "contract baca terkait" on contracts
  for select using (umkm_id = auth.uid() or student_id = auth.uid());

drop policy if exists "milestone baca terkait" on milestones;
create policy "milestone baca terkait" on milestones
  for select using (
    exists (select 1 from contracts ct where ct.id = contract_id
            and (ct.umkm_id = auth.uid() or ct.student_id = auth.uid()))
  );

-- Catatan: INSERT/UPDATE contracts & milestones TIDAK diberi policy untuk
-- client biasa. Pembuatan kontrak (accept lamaran) & perubahan status akan
-- dilakukan lewat Edge Function dengan service role (CP4 lanjutan/CP5),
-- supaya aturan (batas kontrak aktif, transisi status) dijaga di server.
