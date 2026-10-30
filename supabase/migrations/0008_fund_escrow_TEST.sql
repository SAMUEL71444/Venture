-- ============================================================================
-- TEST CP5b — Membuktikan POLA JURNAL funding benar, tanpa menyentuh
-- profiles/contracts (yang punya FK ke auth.users & antar-tabel).
--
-- Kita uji inti yang penting: jurnal ESCROW_FUNDED harus SEIMBANG dan
-- mencatat nominal yang benar. Karena escrow butuh contract nyata, di test
-- ini kita simulasikan "sisi escrow" memakai akun SISTEM sementara
-- ('escrow_test_holding') supaya pola debit/kredit & keseimbangan tetap
-- terbukti. Alur status kontrak (awaiting_payment->funded) diuji via UI.
--
-- Mengembalikan tabel hasil (panel Results), lalu membersihkan diri.
-- ============================================================================

-- Tambah akun sistem sementara untuk menampung sisi "escrow" dalam uji.
insert into system_accounts (key, balance) values ('escrow_test_holding', 0)
on conflict (key) do nothing;

create or replace function _fund_selftest()
returns table(uji text, hasil text)
language plpgsql
as $$
declare
  v_total bigint := 1000000;
  v_tx uuid;
  v_hold bigint; v_gw bigint;
  v_d bigint; v_c bigint;
begin
  -- Jurnal funding (pola IDENTIK dengan fund_escrow, sisi escrow -> akun uji):
  --   gateway_clearing   debit  1.000.000
  --   escrow (uji)              credit 1.000.000
  v_tx := post_ledger('ESCROW_FUNDED_TEST', null, 'test-fund-'||gen_random_uuid()::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','gateway_clearing','debit', v_total),
      jsonb_build_object('account_type','system','system_key','escrow_test_holding','credit', v_total)));

  select balance into v_hold from system_accounts where key = 'escrow_test_holding';
  select balance into v_gw from system_accounts where key = 'gateway_clearing';

  uji := 'Escrow (holding) terisi = Rp 1.000.000';
  hasil := case when v_hold = v_total then 'PASS (='||v_hold||')' else 'FAIL (='||v_hold||')' end; return next;

  -- Konvensi saldo = credit - debit. Gateway clearing kena DEBIT, jadi
  -- saldonya -1.000.000 (benar secara akuntansi: akun transit uang masuk).
  uji := 'Gateway clearing debit tercatat (saldo = -1.000.000)';
  hasil := case when v_gw = -v_total then 'PASS' else 'FAIL (='||v_gw||')' end; return next;

  select coalesce(sum(le.debit),0), coalesce(sum(le.credit),0) into v_d, v_c
  from ledger_entries le where le.transaction_id = v_tx;
  uji := 'Jurnal funding seimbang (debit=credit)';
  hasil := case when v_d = v_c and v_d = v_total then 'PASS (d=c='||v_d||')' else 'FAIL (d='||v_d||' c='||v_c||')' end; return next;

  -- Bersihkan.
  delete from ledger_entries where transaction_id = v_tx;
  delete from ledger_transactions where id = v_tx;
  update system_accounts set balance = 0 where key in ('gateway_clearing','escrow_test_holding');

  uji := '=== BERSIH: data uji dihapus ==='; hasil := 'OK'; return next;
end;
$$;

select * from _fund_selftest();

drop function _fund_selftest();
delete from system_accounts where key = 'escrow_test_holding';
