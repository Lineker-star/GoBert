create table if not exists booking_offers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  provider_id uuid references providers(id),
  offered_at timestamptz default now(),
  responded_at timestamptz,
  response text,
  created_at timestamptz default now()
);
alter table booking_offers enable row level security;
create policy "booking_offers provider read" on booking_offers for select using (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid())));
create policy "booking_offers admin" on booking_offers for all using (is_admin());
