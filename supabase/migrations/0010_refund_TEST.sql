-- ============================================================================
-- TEST CP5d — Membuktikan POLA JURNAL refund benar (angka dokumen).
-- Memakai akun sistem sementara untuk sisi escrow & wallet mentor supaya
-- tidak terbentur FK auth.users. Mengembalikan tabel hasil. Membersihkan diri.
--
-- Skenario dokumen: milestone 2 (600.000) di-refund + fee mentor 21.600
-- ditanggung platform.
-- ============================================================================
insert into system_accounts (key, balance) values
  ('escrow_test_holding', 0), ('mentor_test_wallet', 0)
on conflict (key) do nothing;

create or replace function _refund_selftest()
returns table(uji text, hasil text)
language plpgsql
as $$
declare
  v_refund bigint := 600000;
  v_mentor_fee bigint := 21600;
  v_tx1 uuid; v_tx2 uuid;
  v_refund_payable bigint; v_mentor bigint; v_platform bigint;
  v_d bigint; v_c bigint;
begin
  -- Awali: beri saldo escrow holding = 600.000 (seolah sisa dana ditahan),
  -- dan platform_revenue = 21.600 (seolah ada komisi terkumpul untuk ditarik).
  perform post_ledger('SEED_ESCROW', null, 'seed-esc-'||gen_random_uuid()::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','gateway_clearing','debit',600000),
      jsonb_build_object('account_type','system','system_key','escrow_test_holding','credit',600000)));
  perform post_ledger('SEED_PLATFORM', null, 'seed-plat-'||gen_random_uuid()::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','gateway_clearing','debit',21600),
      jsonb_build_object('account_type','system','system_key','platform_revenue','credit',21600)));

  -- Komponen 1: refund sisa escrow ke UMKM.
  v_tx1 := post_ledger('REFUND', null, 'test-refund-'||gen_random_uuid()::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','escrow_test_holding','debit',v_refund),
      jsonb_build_object('account_type','system','system_key','umkm_refund_payable','credit',v_refund)));

  -- Komponen 2: fee mentor ditanggung platform.
  v_tx2 := post_ledger('MENTOR_FEE_ON_CANCEL', null, 'test-mentorfee-'||gen_random_uuid()::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','platform_revenue','debit',v_mentor_fee),
      jsonb_build_object('account_type','system','system_key','mentor_test_wallet','credit',v_mentor_fee)));

  select balance into v_refund_payable from system_accounts where key='umkm_refund_payable';
  select balance into v_mentor from system_accounts where key='mentor_test_wallet';
  select balance into v_platform from system_accounts where key='platform_revenue';

  uji := 'Refund ke UMKM = 600.000';
  hasil := case when v_refund_payable=600000 then 'PASS' else 'FAIL ('||v_refund_payable||')' end; return next;

  uji := 'Mentor tetap dibayar = 21.600';
  hasil := case when v_mentor=21600 then 'PASS' else 'FAIL ('||v_mentor||')' end; return next;

  uji := 'Platform menanggung fee mentor (21.600 - 21.600 = 0)';
  hasil := case when v_platform=0 then 'PASS' else 'FAIL ('||v_platform||')' end; return next;

  -- Keseimbangan kedua jurnal refund.
  select coalesce(sum(debit),0),coalesce(sum(credit),0) into v_d,v_c from ledger_entries where transaction_id in (v_tx1,v_tx2);
  uji := 'Jurnal refund seimbang (debit=credit)';
  hasil := case when v_d=v_c then 'PASS (d=c='||v_d||')' else 'FAIL (d='||v_d||' c='||v_c||')' end; return next;

  -- Bersihkan semua.
  delete from ledger_entries where transaction_id in (
    select id from ledger_transactions where kind in ('SEED_ESCROW','SEED_PLATFORM','REFUND','MENTOR_FEE_ON_CANCEL'));
  delete from ledger_transactions where kind in ('SEED_ESCROW','SEED_PLATFORM','REFUND','MENTOR_FEE_ON_CANCEL');
  update system_accounts set balance=0 where key in
    ('gateway_clearing','platform_revenue','umkm_refund_payable','escrow_test_holding','mentor_test_wallet');

  uji := '=== BERSIH: data uji dihapus ==='; hasil := 'OK'; return next;
end;
$$;

select * from _refund_selftest();
drop function _refund_selftest();
delete from system_accounts where key in ('escrow_test_holding','mentor_test_wallet');
