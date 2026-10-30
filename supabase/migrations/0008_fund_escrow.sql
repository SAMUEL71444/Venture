-- ============================================================================
-- CP5b — Funding Escrow (UMKM membayar, mock)
-- ============================================================================
-- Saat UMKM "membayar", dana masuk ke escrow kontrak. Jurnal ESCROW_FUNDED:
--   Gateway Clearing   debit  total
--   Escrow Kontrak            credit  total
-- Kontrak: awaiting_payment -> funded. Escrow: pending_funding -> funded.
--
-- Biaya payment gateway ditanggung UMKM (di luar nilai proyek) — di mock ini
-- kita catat nilai proyeknya saja; biaya gateway bisa ditambah saat gateway asli.
-- ============================================================================

create or replace function fund_escrow(p_contract_id uuid)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_contract contracts;
begin
  if v_caller is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_contract from contracts where id = p_contract_id for update;
  if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;

  -- Hanya UMKM pemilik kontrak yang boleh mendanai.
  if v_contract.umkm_id <> v_caller then raise exception 'NOT_CONTRACT_OWNER'; end if;

  -- Hanya kontrak yang menunggu pembayaran.
  if v_contract.status <> 'awaiting_payment' then raise exception 'CONTRACT_NOT_AWAITING_PAYMENT'; end if;

  -- Pastikan baris escrow ada.
  insert into escrows (contract_id, balance, status)
  values (p_contract_id, 0, 'pending_funding')
  on conflict (contract_id) do nothing;

  -- Jurnal double-entry: gateway clearing (debit) -> escrow (credit).
  perform post_ledger(
    'ESCROW_FUNDED', p_contract_id, 'fund-'||p_contract_id::text,
    jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','gateway_clearing','debit', v_contract.total_amount),
      jsonb_build_object('account_type','escrow','escrow_contract', p_contract_id::text, 'credit', v_contract.total_amount)
    )
  );

  update escrows set status = 'funded' where contract_id = p_contract_id;
  update contracts set status = 'funded' where id = p_contract_id returning * into v_contract;

  return v_contract;
end;
$$;

grant execute on function fund_escrow(uuid) to authenticated;
