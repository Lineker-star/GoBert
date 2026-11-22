create table if not exists wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id),
  booking_id uuid references bookings(id),
  entry_type text not null,
  amount_xaf int not null,
  balance_after int,
  created_at timestamptz default now()
);
create table if not exists payout_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id),
  amount_xaf int not null,
  status text default 'pending',
  approved_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table wallet_ledger enable row level security;
alter table payout_requests enable row level security;
create policy "wallet owner read" on wallet_ledger for select using (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid())));
create policy "payout owner read" on payout_requests for select using (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid())));
create policy "payout admin" on payout_requests for all using (is_admin());
