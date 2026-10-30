-- ============================================================================
-- TEST CP5c — Pembagian uang HARUS cocok PERSIS dengan dokumen desain.
-- Menguji compute_milestone_split (fungsi murni, tanpa efek samping / FK).
-- Mengembalikan tabel hasil (panel Results). Tidak mengubah data.
-- ============================================================================
create or replace function _split_selftest()
returns table(uji text, hasil text)
language plpgsql
as $$
declare r record;
begin
  -- Acuan dokumen: milestone 400.000, fee 12%, mentor 30%, min 10.000, ADA mentor.
  --   komisi = 48.000 ; mahasiswa = 352.000 ; mentor = 14.400 ; platform = 33.600
  select * into r from compute_milestone_split(400000, 12, 30, 10000, true);
  uji := 'MS 400.000: mahasiswa=352.000';
  hasil := case when r.student_amount=352000 then 'PASS' else 'FAIL ('||r.student_amount||')' end; return next;
  uji := 'MS 400.000: mentor=14.400';
  hasil := case when r.mentor_fee=14400 then 'PASS' else 'FAIL ('||r.mentor_fee||')' end; return next;
  uji := 'MS 400.000: platform=33.600';
  hasil := case when r.platform_amount=33600 then 'PASS' else 'FAIL ('||r.platform_amount||')' end; return next;
  uji := 'MS 400.000: total bagian = 400.000';
  hasil := case when r.student_amount+r.mentor_fee+r.platform_amount=400000 then 'PASS' else 'FAIL' end; return next;

  -- Milestone 600.000 (milestone 2 di dokumen). komisi=72.000 ;
  --   mahasiswa=528.000 ; mentor=21.600 ; platform=50.400
  select * into r from compute_milestone_split(600000, 12, 30, 10000, true);
  uji := 'MS 600.000: mahasiswa=528.000 & mentor=21.600 & platform=50.400';
  hasil := case when r.student_amount=528000 and r.mentor_fee=21600 and r.platform_amount=50400
            then 'PASS' else 'FAIL ('||r.student_amount||'/'||r.mentor_fee||'/'||r.platform_amount||')' end; return next;

  -- Fee minimum mentor: milestone kecil 150.000, komisi=18.000, 30%=5.400 < 10.000
  --   → mentor dipaksa 10.000 ; platform = 18.000-10.000 = 8.000 ; mhs=132.000
  select * into r from compute_milestone_split(150000, 12, 30, 10000, true);
  uji := 'MS 150.000: fee minimum mentor dipakai (10.000)';
  hasil := case when r.mentor_fee=10000 and r.platform_amount=8000 and r.student_amount=132000
            then 'PASS' else 'FAIL ('||r.student_amount||'/'||r.mentor_fee||'/'||r.platform_amount||')' end; return next;

  -- Tanpa mentor: seluruh komisi jadi pendapatan platform.
  select * into r from compute_milestone_split(400000, 12, 30, 10000, false);
  uji := 'MS 400.000 tanpa mentor: platform=48.000, mentor=0';
  hasil := case when r.mentor_fee=0 and r.platform_amount=48000 and r.student_amount=352000
            then 'PASS' else 'FAIL ('||r.student_amount||'/'||r.mentor_fee||'/'||r.platform_amount||')' end; return next;
end;
$$;

select * from _split_selftest();
drop function _split_selftest();
