-- ============================================================================
-- TEST CP6 — Membuktikan aturan BATAS REVISI benar.
-- Menguji logika: dengan max_revisions_per_milestone = 2, revisi ke-1 & ke-2
-- boleh, permintaan revisi ke-3 (saat revisions_used=2) HARUS ditolak.
--
-- Diuji lewat fungsi murni yang meniru keputusan client_review_milestone,
-- supaya tidak perlu contract nyata (FK auth.users). Alur status penuh diuji
-- via UI. Mengembalikan tabel hasil.
-- ============================================================================
create or replace function _revision_check(p_used int, p_max int)
returns text
language plpgsql immutable
as $$
begin
  if p_used >= p_max then return 'DITOLAK'; else return 'BOLEH'; end if;
end;
$$;

create or replace function _review_selftest()
returns table(uji text, hasil text)
language plpgsql
as $$
declare v_max int;
begin
  select value::int into v_max from platform_settings where key='max_revisions_per_milestone';

  uji := 'Setting max_revisions_per_milestone = 2';
  hasil := case when v_max = 2 then 'PASS' else 'FAIL (='||coalesce(v_max,-1)||')' end; return next;

  uji := 'Revisi ke-1 (used=0) boleh';
  hasil := case when _revision_check(0, v_max)='BOLEH' then 'PASS' else 'FAIL' end; return next;

  uji := 'Revisi ke-2 (used=1) boleh';
  hasil := case when _revision_check(1, v_max)='BOLEH' then 'PASS' else 'FAIL' end; return next;

  uji := 'Revisi ke-3 (used=2) DITOLAK';
  hasil := case when _revision_check(2, v_max)='DITOLAK' then 'PASS' else 'FAIL' end; return next;
end;
$$;

select * from _review_selftest();

drop function _review_selftest();
drop function _revision_check(int, int);
