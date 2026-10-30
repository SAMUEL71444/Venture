-- ============================================================================
-- CP5d — Refund & Pembatalan (REFUND)
-- ============================================================================
-- Saat kontrak dibatalkan, dana yang MASIH ditahan di escrow dikembalikan ke
-- UMKM. Milestone yang sudah cair tidak ditarik kembali.
--
-- Dua komponen jurnal (dari dokumen 06):
--   1) Pengembalian sisa escrow ke UMKM:
--        Escrow            debit   sisa
--        UMKM Refund Payable      credit  sisa
--   2) Jika mentor sudah sempat review suatu milestone yang batal, mentor
--      tetap dibayar, fee-nya dari pendapatan platform:
--        Platform Revenue  debit   fee_mentor
--        Wallet Mentor            credit  fee_mentor
--
-- Fungsi menerima jumlah fee mentor yang harus dibayar (dihitung pemanggil
-- berdasarkan milestone mana yang sudah di-review) agar fleksibel.
-- ============================================================================

create or replace function refund_contract(
  p_contract_id uuid,
  p_mentor_id uuid default null,
  p_mentor_fee bigint default 0
)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_contract contracts;
  v_escrow escrows;
  v_entries jsonb;
begin
  if v_caller is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_contract from contracts where id = p_contract_id for update;
  if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;
  -- Pembatalan dipicu UMKM atau mahasiswa pihak kontrak (admin nanti terpisah).
  if v_contract.umkm_id <> v_caller and v_contract.student_id <> v_caller then
    raise exception 'NOT_CONTRACT_PARTY';
  end if;
  if v_contract.status in ('completed','cancelled') then
    raise exception 'CONTRACT_NOT_CANCELLABLE';
  end if;

  select * into v_escrow from escrows where contract_id = p_contract_id for update;
  if not found then raise exception 'ESCROW_NOT_FOUND'; end if;

  -- Komponen 1: kembalikan sisa escrow (jika ada) ke UMKM.
  if v_escrow.balance > 0 then
    v_entries := jsonb_build_array(
      jsonb_build_object('account_type','escrow','escrow_contract', p_contract_id::text, 'debit', v_escrow.balance),
      jsonb_build_object('account_type','system','system_key','umkm_refund_payable', 'credit', v_escrow.balance)
    );
    perform post_ledger('REFUND', p_contract_id, 'refund-'||p_contract_id::text, v_entries);
    update escrows set status = 'refunded' where contract_id = p_contract_id;
  end if;

  -- Komponen 2: fee mentor ditanggung platform (jika ada).
  if p_mentor_id is not null and p_mentor_fee > 0 then
    perform post_ledger('MENTOR_FEE_ON_CANCEL', p_contract_id, 'mentorfee-'||p_contract_id::text,
      jsonb_build_array(
        jsonb_build_object('account_type','system','system_key','platform_revenue', 'debit', p_mentor_fee),
        jsonb_build_object('account_type','wallet','wallet_owner', p_mentor_id::text, 'credit', p_mentor_fee)
      ));
  end if;

  update contracts set status = 'cancelled' where id = p_contract_id returning * into v_contract;
  update projects set status = 'cancelled' where id = v_contract.project_id;

  return v_contract;
end;
$$;

grant execute on function refund_contract(uuid, uuid, bigint) to authenticated;
