-- ============================================================================
-- TEST CP5b — Funding escrow dengan ANGKA NYATA.
-- Membuat kontrak uji minimal (butuh 2 profil & 1 proyek uji), mendanainya
-- via jurnal yang sama seperti fund_escrow, cek saldo escrow = total,
-- lalu BERSIHKAN semua. Mengembalikan tabel hasil (panel Results).
--
-- Catatan: fund_escrow() butuh auth.uid() = UMKM; di SQL Editor tidak ada
-- sesi auth, jadi test ini memanggil LANGSUNG post_ledger dengan jurnal yang
-- IDENTIK dengan fund_escrow, lalu memverifikasi efeknya. Logika transisi
-- status fund_escrow sendiri diuji via UI nanti.
-- ============================================================================
create or replace function _fund_selftest()
returns table(uji text, hasil text)
language plpgsql
as $$
declare
  v_umkm uuid; v_student uuid; v_project uuid; v_contract uuid;
  v_escrow_bal bigint; v_gw bigint;
  v_total bigint := 1000000;
begin
  -- Profil uji (role umkm & mahasiswa). id acak.
  v_umkm := gen_random_uuid(); v_student := gen_random_uuid();
  insert into profiles (id, role, full_name, display_name, status)
    values (v_umkm, 'umkm', 'UMKM Uji', 'UMKM Uji', 'active');
  insert into profiles (id, role, full_name, display_name, status)
    values (v_student, 'mahasiswa', 'Mhs Uji', 'Mhs Uji', 'active');

  insert into projects (id, umkm_id, title, description, budget, status)
    values (gen_random_uuid(), v_umkm, 'Proyek Uji', '', v_total, 'assigned')
    returning id into v_project;

  insert into contracts (id, project_id, umkm_id, student_id, total_amount, platform_fee_pct, mentor_share_pct, status, contract_no)
    values (gen_random_uuid(), v_project, v_umkm, v_student, v_total, 12, 30, 'awaiting_payment', 'CTR-TEST-'||substr(gen_random_uuid()::text,1,6))
    returning id into v_contract;

  insert into escrows (contract_id, balance, status) values (v_contract, 0, 'pending_funding');

  -- Jurnal funding (identik dengan fund_escrow).
  perform post_ledger('ESCROW_FUNDED', v_contract, 'test-fund-'||v_contract::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','gateway_clearing','debit', v_total),
      jsonb_build_object('account_type','escrow','escrow_contract', v_contract::text, 'credit', v_total)));

  select balance into v_escrow_bal from escrows where contract_id = v_contract;
  select balance into v_gw from system_accounts where key = 'gateway_clearing';

  uji := 'Escrow terisi = Rp 1.000.000';
  hasil := case when v_escrow_bal = v_total then 'PASS (escrow='||v_escrow_bal||')' else 'FAIL (escrow='||v_escrow_bal||')' end; return next;

  uji := 'Gateway clearing debit tercatat = 1.000.000';
  hasil := case when v_gw = v_total then 'PASS' else 'FAIL (gw='||v_gw||')' end; return next;

  -- Cek jurnal benar-benar seimbang (sum debit = sum credit untuk tx ini).
  declare v_d bigint; v_c bigint;
  begin
    select coalesce(sum(le.debit),0), coalesce(sum(le.credit),0) into v_d, v_c
    from ledger_entries le join ledger_transactions lt on lt.id = le.transaction_id
    where lt.contract_id = v_contract;
    uji := 'Jurnal seimbang (debit=credit)';
    hasil := case when v_d = v_c and v_d = v_total then 'PASS (d=c='||v_d||')' else 'FAIL (d='||v_d||' c='||v_c||')' end; return next;
  end;

  -- BERSIHKAN semua data uji + efek saldo.
  delete from ledger_entries where transaction_id in (select id from ledger_transactions where contract_id = v_contract);
  delete from ledger_transactions where contract_id = v_contract;
  delete from escrows where contract_id = v_contract;
  delete from contracts where id = v_contract;
  delete from projects where id = v_project;
  delete from profiles where id in (v_umkm, v_student);
  update system_accounts set balance = 0 where key in ('gateway_clearing','platform_revenue');

  uji := '=== BERSIH: data uji dihapus ==='; hasil := 'OK'; return next;
end;
$$;

select * from _fund_selftest();
drop function _fund_selftest();
