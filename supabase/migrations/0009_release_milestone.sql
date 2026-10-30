-- ============================================================================
-- CP5c — Pencairan per Milestone (MILESTONE_RELEASE)
-- ============================================================================
-- Saat UMKM menyetujui milestone, dana milestone cair dari escrow dan dibagi:
--   komisi      = round(fee_pct% * nilai milestone)
--   bagian mhs  = nilai - komisi
--   fee mentor  = max(round(mentor_share% * komisi), mentor_min_fee),
--                 dibatasi <= komisi
--   platform    = komisi - fee mentor
--
-- Jurnal:
--   Escrow            debit   nilai
--     Wallet Mahasiswa       credit  bagian mhs
--     Wallet Mentor          credit  fee mentor   (jika ada mentor & fee>0)
--     Platform Revenue       credit  sisa platform
--
-- Snapshot persentase diambil dari KONTRAK (bukan platform_settings saat ini),
-- supaya kontrak berjalan tidak terpengaruh perubahan setting.
-- ============================================================================

-- Fungsi murni perhitungan split — bisa diuji tanpa efek samping.
create or replace function compute_milestone_split(
  p_amount bigint, p_fee_pct int, p_mentor_share_pct int,
  p_mentor_min_fee bigint, p_has_mentor boolean
)
returns table(student_amount bigint, mentor_fee bigint, platform_amount bigint, commission bigint)
language plpgsql
immutable
as $$
declare
  v_commission bigint;
  v_mentor bigint;
begin
  v_commission := round(p_amount::numeric * p_fee_pct / 100.0);
  student_amount := p_amount - v_commission;
  commission := v_commission;

  if p_has_mentor then
    v_mentor := greatest(round(v_commission::numeric * p_mentor_share_pct / 100.0), p_mentor_min_fee);
    -- Fee mentor tidak boleh melebihi komisi.
    if v_mentor > v_commission then v_mentor := v_commission; end if;
  else
    v_mentor := 0;
  end if;

  mentor_fee := v_mentor;
  platform_amount := v_commission - v_mentor;
  return next;
end;
$$;

-- Pencairan milestone sesungguhnya.
create or replace function release_milestone(p_milestone_id uuid, p_mentor_id uuid default null)
returns milestones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_ms milestones;
  v_contract contracts;
  v_min_fee bigint;
  v_split record;
  v_entries jsonb;
  v_has_mentor boolean;
begin
  if v_caller is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_ms from milestones where id = p_milestone_id for update;
  if not found then raise exception 'MILESTONE_NOT_FOUND'; end if;

  select * into v_contract from contracts where id = v_ms.contract_id for update;
  -- Hanya UMKM pemilik kontrak yang menyetujui/mencairkan.
  if v_contract.umkm_id <> v_caller then raise exception 'NOT_CONTRACT_OWNER'; end if;
  if v_ms.status = 'approved' then raise exception 'MILESTONE_ALREADY_APPROVED'; end if;

  select value::bigint into v_min_fee from platform_settings where key = 'mentor_min_fee';
  v_has_mentor := p_mentor_id is not null;

  select * into v_split from compute_milestone_split(
    v_ms.amount, v_contract.platform_fee_pct, v_contract.mentor_share_pct,
    coalesce(v_min_fee, 10000), v_has_mentor
  );

  -- Rakit entri jurnal: escrow debit, lalu kredit ke penerima (lewati nominal 0).
  v_entries := jsonb_build_array(
    jsonb_build_object('account_type','escrow','escrow_contract', v_contract.id::text, 'debit', v_ms.amount),
    jsonb_build_object('account_type','wallet','wallet_owner', v_contract.student_id::text, 'credit', v_split.student_amount)
  );
  if v_has_mentor and v_split.mentor_fee > 0 then
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object('account_type','wallet','wallet_owner', p_mentor_id::text, 'credit', v_split.mentor_fee));
  end if;
  if v_split.platform_amount > 0 then
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object('account_type','system','system_key','platform_revenue', 'credit', v_split.platform_amount));
  end if;

  perform post_ledger('MILESTONE_RELEASE', v_contract.id,
    'release-'||p_milestone_id::text, v_entries);

  update milestones set status = 'approved' where id = p_milestone_id returning * into v_ms;
  return v_ms;
end;
$$;

grant execute on function compute_milestone_split(bigint, int, int, bigint, boolean) to authenticated;
grant execute on function release_milestone(uuid, uuid) to authenticated;
