-- ============================================================================
-- CP Admin (simpel) — Fungsi untuk role 'trust': approve/reject KTM + statistik
-- ============================================================================
-- Semua fungsi SECURITY DEFINER dan cek bahwa pemanggil adalah role 'trust'.
-- ============================================================================

-- Helper: apakah pemanggil admin (trust)?
create or replace function is_trust()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'trust');
$$;

-- ---------- Setujui verifikasi mahasiswa → status 'active' ----------
create or replace function admin_approve_student(p_student_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_trust() then raise exception 'FORBIDDEN'; end if;
  update student_profiles set ktm_verification = 'terverifikasi' where profile_id = p_student_id;
  update profiles set status = 'active' where id = p_student_id and role = 'mahasiswa';
end;
$$;

-- ---------- Tolak verifikasi mahasiswa ----------
create or replace function admin_reject_student(p_student_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_trust() then raise exception 'FORBIDDEN'; end if;
  update student_profiles set ktm_verification = 'ditolak' where profile_id = p_student_id;
  -- status tetap pending supaya mahasiswa bisa unggah ulang.
end;
$$;

-- ---------- Tangguhkan / aktifkan user ----------
create or replace function admin_set_status(p_user_id uuid, p_status account_status)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_trust() then raise exception 'FORBIDDEN'; end if;
  update profiles set status = p_status where id = p_user_id;
end;
$$;

-- ---------- Antrean verifikasi (mahasiswa pending yang sudah unggah KTM) ----------
-- Dikembalikan sebagai jsonb supaya admin (trust) bisa baca lintas-user
-- (RLS student_profiles baca publik, tapi kita bungkus rapi di sini).
create or replace function admin_verification_queue()
returns table(
  student_id uuid, name text, university text, ktm_status verification_status, submitted boolean
)
language plpgsql security definer set search_path = public
as $$
begin
  if not is_trust() then raise exception 'FORBIDDEN'; end if;
  return query
    select p.id, p.display_name,
           coalesce(u.name, sp.university_name),
           sp.ktm_verification,
           (sp.ktm_file_path is not null)
    from profiles p
    join student_profiles sp on sp.profile_id = p.id
    left join universities u on u.id = sp.university_id
    where p.role = 'mahasiswa' and sp.ktm_verification in ('pending')
    order by p.created_at asc;
end;
$$;

-- ---------- Statistik ringkas untuk dashboard admin ----------
create or replace function admin_stats()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v jsonb;
begin
  if not is_trust() then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object(
    'total_mahasiswa', (select count(*) from profiles where role='mahasiswa'),
    'total_umkm', (select count(*) from profiles where role='umkm'),
    'mahasiswa_aktif', (select count(*) from profiles where role='mahasiswa' and status='active'),
    'menunggu_verifikasi', (select count(*) from student_profiles where ktm_verification='pending'),
    'proyek_open', (select count(*) from projects where status='open'),
    'proyek_total', (select count(*) from projects),
    'kontrak_aktif', (select count(*) from contracts where status in ('awaiting_payment','funded','in_progress')),
    'kontrak_selesai', (select count(*) from contracts where status='completed'),
    'dana_escrow', (select coalesce(sum(balance),0) from escrows where status='funded'),
    'pendapatan_platform', (select coalesce(balance,0) from system_accounts where key='platform_revenue')
  ) into v;
  return v;
end;
$$;

grant execute on function is_trust() to authenticated;
grant execute on function admin_approve_student(uuid) to authenticated;
grant execute on function admin_reject_student(uuid, text) to authenticated;
grant execute on function admin_set_status(uuid, account_status) to authenticated;
grant execute on function admin_verification_queue() to authenticated;
grant execute on function admin_stats() to authenticated;
