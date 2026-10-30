-- ============================================================================
-- CP4 — Fungsi RPC: melamar proyek & menerima lamaran (atomik, aman)
-- ============================================================================
-- Aturan bisnis ditegakkan di DALAM fungsi (SECURITY DEFINER) supaya tidak
-- bisa dilewati dari browser:
--   * apply_to_project: mahasiswa, proyek harus 'open', belum melamar, batas
--     kontrak aktif, total usulan milestone = bid_amount.
--   * accept_application: UMKM pemilik, buat kontrak + milestone dalam satu
--     transaksi, kunci proyek, tolak lamaran lain, cek batas kontrak aktif.
-- ============================================================================

-- Hitung kontrak aktif milik seorang mahasiswa.
create or replace function active_contract_count(p_student uuid)
returns integer
language sql
stable
as $$
  select count(*)::int from contracts
  where student_id = p_student
    and status in ('awaiting_payment','funded','in_progress','cancellation_requested');
$$;

-- ---------- apply_to_project ----------
create or replace function apply_to_project(
  p_project_id uuid,
  p_proposal text,
  p_bid_amount bigint,
  p_milestones jsonb
)
returns applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid := auth.uid();
  v_role user_role;
  v_project projects;
  v_max_active int;
  v_min_milestone bigint;
  v_sum bigint;
  v_app applications;
begin
  if v_student is null then raise exception 'UNAUTHENTICATED'; end if;

  select role into v_role from profiles where id = v_student;
  if v_role is distinct from 'mahasiswa' then raise exception 'ROLE_FORBIDDEN'; end if;

  select * into v_project from projects where id = p_project_id for share;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if v_project.status <> 'open' then raise exception 'PROJECT_NOT_OPEN'; end if;

  -- Batas kontrak aktif.
  select value::int into v_max_active from platform_settings where key = 'max_active_contracts_per_student';
  if active_contract_count(v_student) >= coalesce(v_max_active, 2) then
    raise exception 'ACTIVE_CONTRACT_LIMIT';
  end if;

  -- Validasi milestone: total = bid, tiap milestone >= minimum.
  select value::bigint into v_min_milestone from platform_settings where key = 'min_milestone_amount';
  select coalesce(sum((m->>'amount')::bigint), 0) into v_sum
  from jsonb_array_elements(coalesce(p_milestones, '[]'::jsonb)) m;
  if v_sum <> p_bid_amount then raise exception 'MILESTONE_SUM_MISMATCH'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_milestones,'[]'::jsonb)) m
    where (m->>'amount')::bigint < coalesce(v_min_milestone, 0)
  ) then raise exception 'MILESTONE_BELOW_MIN'; end if;

  insert into applications (project_id, student_id, proposal, bid_amount, proposed_milestones, status)
  values (p_project_id, v_student, coalesce(p_proposal,''), p_bid_amount, coalesce(p_milestones,'[]'::jsonb), 'pending')
  returning * into v_app;

  update projects set applicants_count = applicants_count + 1 where id = p_project_id;

  return v_app;
exception
  when unique_violation then raise exception 'ALREADY_APPLIED';
end;
$$;

-- ---------- accept_application ----------
create or replace function accept_application(p_application_id uuid)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_umkm uuid := auth.uid();
  v_app applications;
  v_project projects;
  v_fee_pct int;
  v_mentor_pct int;
  v_max_active int;
  v_contract contracts;
  v_m jsonb;
  v_seq int := 0;
begin
  if v_umkm is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_app from applications where id = p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if v_app.status <> 'pending' then raise exception 'APPLICATION_NOT_PENDING'; end if;

  select * into v_project from projects where id = v_app.project_id for update;
  if v_project.umkm_id <> v_umkm then raise exception 'NOT_PROJECT_OWNER'; end if;
  if v_project.status <> 'open' then raise exception 'PROJECT_NOT_OPEN'; end if;

  -- Cek ulang batas kontrak aktif mahasiswa (bisa berubah sejak melamar).
  select value::int into v_max_active from platform_settings where key = 'max_active_contracts_per_student';
  if active_contract_count(v_app.student_id) >= coalesce(v_max_active, 2) then
    raise exception 'STUDENT_CONTRACT_LIMIT';
  end if;

  -- Snapshot komisi saat ini.
  select value::int into v_fee_pct from platform_settings where key = 'platform_fee_pct';
  select value::int into v_mentor_pct from platform_settings where key = 'mentor_share_pct';

  insert into contracts (project_id, umkm_id, student_id, application_id, total_amount,
                         platform_fee_pct, mentor_share_pct, status, contract_no)
  values (v_project.id, v_umkm, v_app.student_id, v_app.id, v_app.bid_amount,
          coalesce(v_fee_pct,12), coalesce(v_mentor_pct,30), 'awaiting_payment',
          'CTR-' || to_char(now(),'YYYYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6))
  returning * into v_contract;

  -- Milestone dari usulan lamaran, status locked.
  for v_m in select * from jsonb_array_elements(v_app.proposed_milestones) loop
    v_seq := v_seq + 1;
    insert into milestones (contract_id, seq, name, amount, status)
    values (v_contract.id, v_seq, coalesce(v_m->>'name', 'Milestone '||v_seq),
            (v_m->>'amount')::bigint, 'locked');
  end loop;

  -- Lamaran ini accepted, lamaran lain di proyek yang sama rejected.
  update applications set status = 'accepted' where id = v_app.id;
  update applications set status = 'rejected'
    where project_id = v_project.id and id <> v_app.id and status = 'pending';

  -- Proyek jadi assigned.
  update projects set status = 'assigned' where id = v_project.id;

  return v_contract;
end;
$$;

-- Izinkan pemanggilan oleh user login.
grant execute on function apply_to_project(uuid, text, bigint, jsonb) to authenticated;
grant execute on function accept_application(uuid) to authenticated;
grant execute on function active_contract_count(uuid) to authenticated;
