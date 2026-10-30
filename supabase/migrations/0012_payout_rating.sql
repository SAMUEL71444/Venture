-- ============================================================================
-- CP7 — Payout (penarikan saldo) + Rating
-- ============================================================================
-- Payout: mahasiswa/mentor menarik saldo wallet.
--   * minimum penarikan = min_withdrawal_amount (Rp 20.000)
--   * biaya transfer dipotong dari jumlah yang ditarik (ditanggung penarik)
--   * saldo wallet berkurang sebesar jumlah tarik
--   Jurnal WITHDRAWAL:
--     Wallet         debit   jumlah
--       Payout Clearing      credit  jumlah - biaya
--       Transfer Fee Payable credit  biaya
-- ============================================================================

do $$ begin
  create type payout_status as enum ('processing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists payouts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete restrict,
  amount        bigint not null,              -- jumlah ditarik (kotor)
  fee           bigint not null default 0,    -- biaya transfer
  net_amount    bigint not null,              -- diterima penarik
  status        payout_status not null default 'processing',
  created_at    timestamptz not null default now()
);
create index if not exists idx_payout_owner on payouts(owner_id);

create table if not exists ratings (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid references contracts(id) on delete cascade,
  rater_id      uuid not null references profiles(id) on delete cascade,
  ratee_id      uuid not null references profiles(id) on delete cascade,
  stars         int not null check (stars between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now(),
  unique (contract_id, rater_id, ratee_id)
);
create index if not exists idx_rating_ratee on ratings(ratee_id);

-- ---------- RLS ----------
alter table payouts  enable row level security;
alter table ratings  enable row level security;

drop policy if exists "payout baca milik sendiri" on payouts;
create policy "payout baca milik sendiri" on payouts for select using (owner_id = auth.uid());

drop policy if exists "rating baca semua" on ratings;
create policy "rating baca semua" on ratings for select using (true);
-- Insert rating lewat fungsi (validasi pihak kontrak) — tidak langsung.

-- ============================================================================
-- Fungsi: request_payout
-- ============================================================================
create or replace function request_payout(p_amount bigint)
returns payouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_min bigint; v_fee bigint; v_bal bigint; v_net bigint;
  v_payout payouts;
begin
  if v_caller is null then raise exception 'UNAUTHENTICATED'; end if;

  select value::bigint into v_min from platform_settings where key='min_withdrawal_amount';
  if p_amount < coalesce(v_min, 20000) then raise exception 'BELOW_MIN_WITHDRAWAL'; end if;

  -- Biaya transfer: ambil dari setting bila ada, default 2500.
  select coalesce((select value::bigint from platform_settings where key='withdrawal_fee'), 2500) into v_fee;
  if v_fee >= p_amount then raise exception 'FEE_EXCEEDS_AMOUNT'; end if;
  v_net := p_amount - v_fee;

  -- Kunci wallet & cek saldo cukup.
  select balance into v_bal from wallets where owner_id = v_caller for update;
  if v_bal is null or v_bal < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  -- Jurnal penarikan.
  perform post_ledger('WITHDRAWAL', null, 'payout-'||gen_random_uuid()::text,
    jsonb_build_array(
      jsonb_build_object('account_type','wallet','wallet_owner', v_caller::text, 'debit', p_amount),
      jsonb_build_object('account_type','system','system_key','payout_clearing', 'credit', v_net),
      jsonb_build_object('account_type','system','system_key','transfer_fee_payable', 'credit', v_fee)
    ));

  insert into payouts (owner_id, amount, fee, net_amount, status)
  values (v_caller, p_amount, v_fee, v_net, 'processing')
  returning * into v_payout;

  return v_payout;
end;
$$;

-- ============================================================================
-- Fungsi: submit_rating (pihak kontrak menilai pihak lain)
-- ============================================================================
create or replace function submit_rating(p_contract_id uuid, p_ratee_id uuid, p_stars int, p_comment text default null)
returns ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_contract contracts;
  v_rating ratings;
  v_avg numeric;
begin
  if v_caller is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_stars < 1 or p_stars > 5 then raise exception 'INVALID_STARS'; end if;

  select * into v_contract from contracts where id = p_contract_id;
  if not found then raise exception 'CONTRACT_NOT_FOUND'; end if;
  -- Penilai harus pihak kontrak.
  if v_caller not in (v_contract.umkm_id, v_contract.student_id) then raise exception 'NOT_CONTRACT_PARTY'; end if;

  insert into ratings (contract_id, rater_id, ratee_id, stars, comment)
  values (p_contract_id, v_caller, p_ratee_id, p_stars, p_comment)
  returning * into v_rating;

  -- Perbarui rating_avg mahasiswa jika yang dinilai mahasiswa.
  select avg(stars)::numeric(3,2) into v_avg from ratings where ratee_id = p_ratee_id;
  update student_profiles set rating_avg = coalesce(v_avg, 0) where profile_id = p_ratee_id;

  return v_rating;
exception when unique_violation then raise exception 'ALREADY_RATED';
end;
$$;

grant execute on function request_payout(bigint) to authenticated;
grant execute on function submit_rating(uuid, uuid, int, text) to authenticated;
