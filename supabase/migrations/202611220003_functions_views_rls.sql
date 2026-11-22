-- helper functions
create or replace function is_admin() returns boolean language sql security definer as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role='admin');
$$;

create or replace function is_provider() returns boolean language sql security definer as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role='provider');
$$;

create or replace function current_anon_token() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'anon_token','') ;
$$;

-- views
create or replace view v_public_providers as
select id, display_name, city_id, rating_avg, rating_count, accepts_direct_calls, is_online, last_location, last_seen_at
from providers where verification_status='approved';

create or replace view v_public_services as
select s.id, s.provider_id, s.service_type, s.title_fr, s.title_en, s.description_fr, s.description_en,
  s.base_price_xaf, s.price_per_km_xaf, s.price_per_hour_xaf, s.price_per_day_xaf, s.zones, s.status
from services s join providers p on p.id=s.provider_id
where s.status='approved' and p.verification_status='approved';

create or replace view v_public_vehicles as
select v.id, v.provider_id, v.vehicle_type, v.brand, v.model, v.year, v.color, v.seats, v.payload_kg, v.photos
from vehicles v join providers p on p.id=v.provider_id
where v.status='approved' and p.verification_status='approved';

-- RLS
alter table profiles enable row level security;
alter table providers enable row level security;
alter table provider_documents enable row level security;
alter table vehicles enable row level security;
alter table services enable row level security;
alter table bookings enable row level security;
alter table payments enable row level security;
alter table ratings enable row level security;

create policy "profiles self" on profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "profiles admin read" on profiles for select using (is_admin());

create policy "providers public read approved" on providers for select using (verification_status='approved');
create policy "providers self write" on providers for all using (profile_id in (select id from profiles where user_id=auth.uid())) with check (profile_id in (select id from profiles where user_id=auth.uid()));
create policy "providers admin all" on providers for all using (is_admin());

create policy "provider_documents owner" on provider_documents for all using (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid()))) with check (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid())));
create policy "provider_documents admin" on provider_documents for all using (is_admin());

create policy "vehicles public read approved" on vehicles for select using (status='approved');
create policy "vehicles owner write" on vehicles for all using (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid()))) with check (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid())));

create policy "services public read approved" on services for select using (status='approved');
create policy "services owner write" on services for all using (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid()))) with check (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid())));

create policy "bookings own passenger" on bookings for all using (passenger_id in (select id from profiles where user_id=auth.uid()) or anon_token = current_anon_token()) with check (passenger_id in (select id from profiles where user_id=auth.uid()) or anon_token = current_anon_token());
create policy "bookings provider read offered" on bookings for select using (provider_id in (select id from providers where profile_id in (select id from profiles where user_id=auth.uid())));
create policy "bookings admin" on bookings for all using (is_admin());

create policy "payments own" on payments for select using (booking_id in (select id from bookings where passenger_id in (select id from profiles where user_id=auth.uid()) or anon_token=current_anon_token()));
create policy "payments admin" on payments for all using (is_admin());

create policy "ratings read" on ratings for select using (true);
create policy "ratings insert own" on ratings for insert with check (from_id in (select id from profiles where user_id=auth.uid()));
