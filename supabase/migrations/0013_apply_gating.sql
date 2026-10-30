-- ============================================================================
-- CP (gating) — Mahasiswa harus TERVERIFIKASI (status active) untuk melamar.
-- ============================================================================
-- Mahasiswa yang masih 'pending' boleh lihat-lihat proyek, tapi TIDAK boleh
-- melamar sampai admin menyetujui KTM-nya (status profiles -> 'active').
-- Kita perbarui apply_to_project agar menolak jika status bukan 'active'.
-- ============================================================================

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
  v_status account_status;
  v_project projects;
  v_max_active int;
  v_min_milestone bigint;
  v_sum bigint;
  v_app applications;
begin
  if v_student is null then raise exception 'UNAUTHENTICATED'; end if;

  select role, status into v_role, v_status from profiles where id = v_student;
  if v_role is distinct from 'mahasiswa' then raise exception 'ROLE_FORBIDDEN'; end if;
  -- GATING: wajib terverifikasi.
  if v_status is distinct from 'active' then raise exception 'NOT_VERIFIED'; end if;

  select * into v_project from projects where id = p_project_id for share;
  if not found then raise exception 'PROJECT_NOT_FOUND'; end if;
  if v_project.status <> 'open' then raise exception 'PROJECT_NOT_OPEN'; end if;

  select value::int into v_max_active from platform_settings where key = 'max_active_contracts_per_student';
  if active_contract_count(v_student) >= coalesce(v_max_active, 2) then
    raise exception 'ACTIVE_CONTRACT_LIMIT';
  end if;

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

grant execute on function apply_to_project(uuid, text, bigint, jsonb) to authenticated;
