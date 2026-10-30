-- ============================================================================
-- CP5a — Fondasi Keuangan: Ledger Double-Entry + Wallet + Escrow
-- ============================================================================
-- Aturan ketat (meniru desain Laravel temanmu):
--   * Uang = BIGINT Rupiah. Tidak ada desimal/float.
--   * Double-entry: setiap transaksi (ledger_transactions) punya >=2 entri
--     (ledger_entries). TOTAL DEBIT HARUS SAMA DENGAN TOTAL KREDIT.
--   * Fungsi post_ledger() satu-satunya cara menulis jurnal; ia memvalidasi
--     keseimbangan, nominal positif, dan idempotency key unik.
--   * Saldo wallet & escrow di-cache dan diperbarui dengan row lock.
--
-- Konvensi akun (account):
--   type: 'wallet' (saldo user) | 'escrow' (dana kontrak ditahan)
--        | 'system' (akun platform: gateway_clearing, platform_revenue,
--          umkm_refund_payable, payout_clearing, transfer_fee_payable)
-- ============================================================================

-- ---------- wallets: saldo per user (mahasiswa/mentor/umkm) ----------
create table if not exists wallets (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete restrict,
  balance     bigint not null default 0,  -- cache saldo (Rupiah)
  created_at  timestamptz not null default now(),
  unique (owner_id)
);

-- ---------- escrows: dana yang ditahan per kontrak ----------
create table if not exists escrows (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete restrict,
  balance     bigint not null default 0,  -- cache saldo ditahan (Rupiah)
  status      text not null default 'pending_funding', -- pending_funding|funded|released|refunded
  created_at  timestamptz not null default now(),
  unique (contract_id)
);

-- ---------- system_accounts: akun platform (satu baris per jenis) ----------
create table if not exists system_accounts (
  key         text primary key,   -- gateway_clearing, platform_revenue, dll
  balance     bigint not null default 0
);

insert into system_accounts (key, balance) values
  ('gateway_clearing', 0),
  ('platform_revenue', 0),
  ('umkm_refund_payable', 0),
  ('payout_clearing', 0),
  ('transfer_fee_payable', 0)
on conflict (key) do nothing;

-- ---------- ledger_transactions: satu peristiwa keuangan ----------
create table if not exists ledger_transactions (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null,         -- ESCROW_FUNDED | MILESTONE_RELEASE | REFUND | WITHDRAWAL | ...
  contract_id     uuid references contracts(id),
  idempotency_key text not null unique,  -- cegah posting ganda
  created_at      timestamptz not null default now()
);

-- ---------- ledger_entries: baris debit/kredit per transaksi ----------
-- Tepat salah satu dari (wallet_owner, escrow_contract, system_key) terisi.
create table if not exists ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references ledger_transactions(id) on delete cascade,
  account_type    text not null,         -- 'wallet' | 'escrow' | 'system'
  wallet_owner    uuid references profiles(id),
  escrow_contract uuid references contracts(id),
  system_key      text references system_accounts(key),
  debit           bigint not null default 0,
  credit          bigint not null default 0,
  created_at      timestamptz not null default now(),
  constraint entry_nonneg check (debit >= 0 and credit >= 0),
  constraint entry_one_side check (
    (debit = 0 and credit > 0) or (debit > 0 and credit = 0)
  )
);
create index if not exists idx_entries_tx on ledger_entries(transaction_id);

-- ---------- RLS ----------
alter table wallets             enable row level security;
alter table escrows             enable row level security;
alter table ledger_transactions enable row level security;
alter table ledger_entries      enable row level security;
alter table system_accounts     enable row level security;

-- User boleh lihat SALDO wallet-nya sendiri. Jurnal & akun sistem tidak
-- diekspos ke client (hanya lewat fungsi server / role trust nanti).
drop policy if exists "wallet baca milik sendiri" on wallets;
create policy "wallet baca milik sendiri" on wallets
  for select using (owner_id = auth.uid());

-- escrow: pihak kontrak boleh lihat saldo escrow kontraknya.
drop policy if exists "escrow baca terkait" on escrows;
create policy "escrow baca terkait" on escrows
  for select using (
    exists (select 1 from contracts ct where ct.id = contract_id
            and (ct.umkm_id = auth.uid() or ct.student_id = auth.uid()))
  );

-- ledger_entries / transactions / system_accounts: TIDAK ada policy select
-- untuk client biasa (default deny). Hanya fungsi SECURITY DEFINER yang akses.

-- ============================================================================
-- Fungsi inti: post_ledger(kind, contract_id, idempotency_key, entries jsonb)
-- entries: [{ account_type, wallet_owner?, escrow_contract?, system_key?,
--             debit?, credit? }]
-- Memvalidasi keseimbangan lalu memperbarui cache saldo. Atomik.
-- ============================================================================
create or replace function post_ledger(
  p_kind text,
  p_contract_id uuid,
  p_idempotency_key text,
  p_entries jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx uuid;
  v_sum_debit bigint := 0;
  v_sum_credit bigint := 0;
  e jsonb;
  v_debit bigint;
  v_credit bigint;
  v_type text;
begin
  if jsonb_array_length(coalesce(p_entries,'[]'::jsonb)) < 2 then
    raise exception 'LEDGER_MIN_TWO_ENTRIES';
  end if;

  -- Idempotency: kalau key sudah ada, kembalikan transaksi lama (no-op aman).
  select id into v_tx from ledger_transactions where idempotency_key = p_idempotency_key;
  if found then return v_tx; end if;

  -- Jumlahkan & validasi tiap entri.
  for e in select * from jsonb_array_elements(p_entries) loop
    v_debit := coalesce((e->>'debit')::bigint, 0);
    v_credit := coalesce((e->>'credit')::bigint, 0);
    v_type := e->>'account_type';
    if v_debit < 0 or v_credit < 0 then raise exception 'LEDGER_NEGATIVE'; end if;
    if (v_debit > 0 and v_credit > 0) or (v_debit = 0 and v_credit = 0) then
      raise exception 'LEDGER_ENTRY_ONE_SIDE';
    end if;
    if v_type not in ('wallet','escrow','system') then raise exception 'LEDGER_BAD_ACCOUNT_TYPE'; end if;
    v_sum_debit := v_sum_debit + v_debit;
    v_sum_credit := v_sum_credit + v_credit;
  end loop;

  if v_sum_debit <> v_sum_credit then
    raise exception 'LEDGER_UNBALANCED: debit=% credit=%', v_sum_debit, v_sum_credit;
  end if;

  insert into ledger_transactions (kind, contract_id, idempotency_key)
  values (p_kind, p_contract_id, p_idempotency_key) returning id into v_tx;

  -- Tulis entri + perbarui cache saldo. Konvensi saldo:
  --   wallet & system: saldo bertambah saat KREDIT, berkurang saat DEBIT
  --   escrow: saldo bertambah saat KREDIT (didanai), berkurang saat DEBIT (cair)
  for e in select * from jsonb_array_elements(p_entries) loop
    v_debit := coalesce((e->>'debit')::bigint, 0);
    v_credit := coalesce((e->>'credit')::bigint, 0);
    v_type := e->>'account_type';

    insert into ledger_entries (transaction_id, account_type, wallet_owner, escrow_contract, system_key, debit, credit)
    values (
      v_tx, v_type,
      nullif(e->>'wallet_owner','')::uuid,
      nullif(e->>'escrow_contract','')::uuid,
      nullif(e->>'system_key',''),
      v_debit, v_credit
    );

    if v_type = 'wallet' then
      insert into wallets (owner_id, balance) values ((e->>'wallet_owner')::uuid, 0)
        on conflict (owner_id) do nothing;
      update wallets set balance = balance + v_credit - v_debit
        where owner_id = (e->>'wallet_owner')::uuid;
    elsif v_type = 'escrow' then
      insert into escrows (contract_id, balance) values ((e->>'escrow_contract')::uuid, 0)
        on conflict (contract_id) do nothing;
      update escrows set balance = balance + v_credit - v_debit
        where contract_id = (e->>'escrow_contract')::uuid;
    elsif v_type = 'system' then
      update system_accounts set balance = balance + v_credit - v_debit
        where key = (e->>'system_key');
    end if;
  end loop;

  return v_tx;
end;
$$;

-- Fungsi ini TIDAK di-grant ke authenticated: hanya dipanggil oleh fungsi
-- keuangan lain (CP5b/c/d) yang juga SECURITY DEFINER. Client tidak boleh
-- memanggil post_ledger langsung.
revoke all on function post_ledger(text, uuid, text, jsonb) from public;
