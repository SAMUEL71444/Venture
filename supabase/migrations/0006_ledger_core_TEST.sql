-- ============================================================================
-- TEST CP5a — Membuktikan ledger double-entry benar.
-- Membuat fungsi uji sementara yang MENGEMBALIKAN TABEL hasil (muncul di panel
-- Results), menangani error di dalam, lalu membersihkan data uji. Aman.
-- Jalankan di SQL Editor dan BACA kolom "uji" & "hasil" di panel Results.
-- ============================================================================
create or replace function _ledger_selftest()
returns table(uji text, hasil text)
language plpgsql
as $$
declare
  v_tx uuid; v_tx2 uuid; v_err text; v_key text;
begin
  -- TEST 1: transaksi seimbang diterima.
  begin
    v_tx := post_ledger('SELFTEST_BAL', null, 'st-bal-'||gen_random_uuid()::text,
      jsonb_build_array(
        jsonb_build_object('account_type','system','system_key','gateway_clearing','debit',1000000),
        jsonb_build_object('account_type','system','system_key','platform_revenue','credit',1000000)));
    uji := 'TEST 1 - transaksi seimbang diterima';
    hasil := case when v_tx is not null then 'PASS' else 'FAIL' end; return next;
  exception when others then
    uji := 'TEST 1 - transaksi seimbang diterima'; hasil := 'FAIL ('||sqlerrm||')'; return next;
  end;

  -- TEST 2: transaksi TIDAK seimbang DITOLAK.
  begin
    perform post_ledger('SELFTEST_UNBAL', null, 'st-unbal-'||gen_random_uuid()::text,
      jsonb_build_array(
        jsonb_build_object('account_type','system','system_key','gateway_clearing','debit',1000000),
        jsonb_build_object('account_type','system','system_key','platform_revenue','credit',999999)));
    uji := 'TEST 2 - tak seimbang ditolak'; hasil := 'FAIL (malah diterima)'; return next;
  exception when others then
    get stacked diagnostics v_err = message_text;
    uji := 'TEST 2 - tak seimbang ditolak';
    hasil := case when v_err like 'LEDGER_UNBALANCED%' then 'PASS' else 'FAIL ('||v_err||')' end; return next;
  end;

  -- TEST 3: entri dua-sisi (debit & credit >0) ditolak.
  begin
    perform post_ledger('SELFTEST_BADSIDE', null, 'st-bad-'||gen_random_uuid()::text,
      jsonb_build_array(
        jsonb_build_object('account_type','system','system_key','gateway_clearing','debit',100,'credit',100),
        jsonb_build_object('account_type','system','system_key','platform_revenue','credit',100)));
    uji := 'TEST 3 - entri dua-sisi ditolak'; hasil := 'FAIL (malah diterima)'; return next;
  exception when others then
    uji := 'TEST 3 - entri dua-sisi ditolak'; hasil := 'PASS'; return next;
  end;

  -- TEST 4: idempotency.
  v_key := 'st-idem-'||gen_random_uuid()::text;
  v_tx := post_ledger('SELFTEST_IDEM', null, v_key,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','gateway_clearing','debit',500),
      jsonb_build_object('account_type','system','system_key','platform_revenue','credit',500)));
  v_tx2 := post_ledger('SELFTEST_IDEM', null, v_key,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','gateway_clearing','debit',500),
      jsonb_build_object('account_type','system','system_key','platform_revenue','credit',500)));
  uji := 'TEST 4 - idempotency (tak posting ganda)';
  hasil := case when v_tx = v_tx2 then 'PASS' else 'FAIL' end; return next;

  -- Bersihkan SEMUA data uji (transaksi + entri + efek saldo sistem).
  -- Kembalikan saldo system_accounts ke 0 untuk akun yang kita sentuh di uji
  -- (nilai nyata belum ada di tahap ini, jadi reset ke 0 aman).
  delete from ledger_entries where transaction_id in (select id from ledger_transactions where kind like 'SELFTEST_%');
  delete from ledger_transactions where kind like 'SELFTEST_%';
  update system_accounts set balance = 0 where key in ('gateway_clearing','platform_revenue');

  uji := '=== BERSIH: data uji dihapus ==='; hasil := 'OK'; return next;
end;
$$;

select * from _ledger_selftest();

drop function _ledger_selftest();
