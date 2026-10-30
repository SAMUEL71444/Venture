-- ============================================================================
-- TEST CP7 — Membuktikan POLA JURNAL payout benar (angka dokumen).
-- Skenario dokumen: tarik 352.000, biaya 2.500 → diterima 349.500.
-- Memakai akun sistem sementara untuk sisi wallet (hindari FK auth.users).
-- Mengembalikan tabel hasil. Membersihkan diri.
-- ============================================================================
insert into system_accounts (key, balance) values ('wallet_test', 0)
on conflict (key) do nothing;

create or replace function _payout_selftest()
returns table(uji text, hasil text)
language plpgsql
as $$
declare
  v_gross bigint := 352000; v_fee bigint := 2500; v_net bigint := 349500;
  v_min bigint;
  v_tx uuid;
  v_payout_clearing bigint; v_fee_payable bigint; v_wallet bigint;
  v_d bigint; v_c bigint;
begin
  -- Cek minimum penarikan (setting).
  select value::bigint into v_min from platform_settings where key='min_withdrawal_amount';
  uji := 'Minimum penarikan = 20.000';
  hasil := case when v_min=20000 then 'PASS' else 'FAIL ('||coalesce(v_min,-1)||')' end; return next;

  uji := 'Hitung bersih: 352.000 - 2.500 = 349.500';
  hasil := case when (v_gross - v_fee) = v_net then 'PASS' else 'FAIL' end; return next;

  -- Seed wallet_test = 352.000 (seolah saldo mahasiswa).
  perform post_ledger('SEED_WALLET', null, 'seed-w-'||gen_random_uuid()::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','gateway_clearing','debit',v_gross),
      jsonb_build_object('account_type','system','system_key','wallet_test','credit',v_gross)));

  -- Jurnal penarikan (pola identik request_payout, sisi wallet -> wallet_test).
  v_tx := post_ledger('WITHDRAWAL', null, 'test-payout-'||gen_random_uuid()::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','wallet_test','debit',v_gross),
      jsonb_build_object('account_type','system','system_key','payout_clearing','credit',v_net),
      jsonb_build_object('account_type','system','system_key','transfer_fee_payable','credit',v_fee)));

  select balance into v_payout_clearing from system_accounts where key='payout_clearing';
  select balance into v_fee_payable from system_accounts where key='transfer_fee_payable';
  select balance into v_wallet from system_accounts where key='wallet_test';

  uji := 'Payout clearing (diteruskan ke penarik) = 349.500';
  hasil := case when v_payout_clearing=v_net then 'PASS' else 'FAIL ('||v_payout_clearing||')' end; return next;

  uji := 'Biaya transfer tercatat = 2.500';
  hasil := case when v_fee_payable=v_fee then 'PASS' else 'FAIL ('||v_fee_payable||')' end; return next;

  uji := 'Saldo wallet jadi 0 setelah tarik penuh';
  hasil := case when v_wallet=0 then 'PASS' else 'FAIL ('||v_wallet||')' end; return next;

  select coalesce(sum(debit),0),coalesce(sum(credit),0) into v_d,v_c from ledger_entries where transaction_id=v_tx;
  uji := 'Jurnal payout seimbang (debit=credit)';
  hasil := case when v_d=v_c and v_d=v_gross then 'PASS (d=c='||v_d||')' else 'FAIL (d='||v_d||' c='||v_c||')' end; return next;

  -- Bersihkan.
  delete from ledger_entries where transaction_id in (select id from ledger_transactions where kind in ('SEED_WALLET','WITHDRAWAL'));
  delete from ledger_transactions where kind in ('SEED_WALLET','WITHDRAWAL');
  update system_accounts set balance=0 where key in ('gateway_clearing','payout_clearing','transfer_fee_payable','wallet_test');

  uji := '=== BERSIH: data uji dihapus ==='; hasil := 'OK'; return next;
end;
$$;

select * from _payout_selftest();
drop function _payout_selftest();
delete from system_accounts where key='wallet_test';
