-- ============================================================================
-- CP6 — Submission + Mentor Review + Batas Revisi
-- ============================================================================
-- Alur per milestone:
--   1. Mahasiswa klik "Mulai Kerja" → milestone in_progress, mentor ditugaskan.
--   2. Mahasiswa submit hasil → submission (status submitted) → mentor review.
--   3. Mentor: approve → diteruskan ke UMKM (in_review) ; atau needs_changes
--      (kembali ke mahasiswa; maks 3 pengembalian mentor → escalated).
--   4. UMKM: approve → milestone approved (picu pencairan) ; atau minta revisi
--      (maks 2 revisi; lebih dari itu → hanya approve / sengketa).
-- ============================================================================

do $$ begin
  create type submission_status as enum ('submitted', 'mentor_approved', 'needs_changes', 'client_approved');
exception when duplicate_object then null; end $$;

-- Penugasan mentor ke milestone.
create table if not exists mentor_assignments (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid not null references milestones(id) on delete cascade,
  mentor_id     uuid not null references profiles(id) on delete restrict,
  fee_eligible  boolean not null default false,  -- true setelah review pertama
  fee_amount    bigint,
  fee_paid_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (milestone_id)
);

-- Submission hasil kerja mahasiswa (bisa banyak per milestone: revisi).
create table if not exists submissions (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid not null references milestones(id) on delete cascade,
  student_id    uuid not null references profiles(id) on delete restrict,
  note          text,
  file_path     text,                          -- di bucket privat
  status        submission_status not null default 'submitted',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_sub_milestone on submissions(milestone_id);

drop trigger if exists trg_sub_updated on submissions;
create trigger trg_sub_updated before update on submissions
  for each row execute function set_updated_at();

-- Catatan review (mentor atau umkm).
create table if not exists submission_reviews (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  reviewer_id   uuid not null references profiles(id) on delete restrict,
  reviewer_role text not null,                  -- 'mentor' | 'umkm'
  decision      text not null,                  -- 'approved' | 'needs_changes'
  comment       text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_review_sub on submission_reviews(submission_id);

-- ---------- RLS ----------
alter table mentor_assignments  enable row level security;
alter table submissions         enable row level security;
alter table submission_reviews  enable row level security;

-- Submission: mahasiswa pemilik & pihak kontrak terkait boleh baca.
drop policy if exists "sub baca terkait" on submissions;
create policy "sub baca terkait" on submissions
  for select using (
    student_id = auth.uid()
    or exists (select 1 from milestones m join contracts c on c.id=m.contract_id
               where m.id = milestone_id and (c.umkm_id=auth.uid() or c.student_id=auth.uid()))
  );

drop policy if exists "assign baca terkait" on mentor_assignments;
create policy "assign baca terkait" on mentor_assignments
  for select using (
    mentor_id = auth.uid()
    or exists (select 1 from milestones m join contracts c on c.id=m.contract_id
               where m.id = milestone_id and (c.umkm_id=auth.uid() or c.student_id=auth.uid()))
  );

drop policy if exists "review baca terkait" on submission_reviews;
create policy "review baca terkait" on submission_reviews
  for select using (
    reviewer_id = auth.uid()
    or exists (select 1 from submissions s join milestones m on m.id=s.milestone_id
               join contracts c on c.id=m.contract_id
               where s.id = submission_id and (c.umkm_id=auth.uid() or c.student_id=auth.uid()))
  );

-- Perubahan status dilakukan lewat fungsi SECURITY DEFINER (0012), bukan
-- insert/update langsung dari client.

-- ============================================================================
-- Fungsi: review UMKM (approve → pencairan, atau minta revisi dengan batas).
-- ============================================================================
create or replace function client_review_milestone(
  p_milestone_id uuid,
  p_decision text,            -- 'approve' | 'request_revision'
  p_comment text default null,
  p_mentor_id uuid default null
)
returns milestones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_ms milestones;
  v_contract contracts;
  v_max_rev int;
begin
  if v_caller is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_ms from milestones where id = p_milestone_id for update;
  if not found then raise exception 'MILESTONE_NOT_FOUND'; end if;
  select * into v_contract from contracts where id = v_ms.contract_id;
  if v_contract.umkm_id <> v_caller then raise exception 'NOT_CONTRACT_OWNER'; end if;

  if p_decision = 'approve' then
    -- Memicu pencairan (CP5c). release_milestone juga cek kepemilikan & set approved.
    perform release_milestone(p_milestone_id, p_mentor_id);
    select * into v_ms from milestones where id = p_milestone_id;
    return v_ms;

  elsif p_decision = 'request_revision' then
    select value::int into v_max_rev from platform_settings where key = 'max_revisions_per_milestone';
    if v_ms.revisions_used >= coalesce(v_max_rev, 2) then
      raise exception 'REVISION_LIMIT_REACHED';   -- hanya boleh approve / sengketa
    end if;
    update milestones
      set status = 'revision', revisions_used = revisions_used + 1
      where id = p_milestone_id returning * into v_ms;
    return v_ms;
  else
    raise exception 'INVALID_DECISION';
  end if;
end;
$$;

grant execute on function client_review_milestone(uuid, text, text, uuid) to authenticated;
