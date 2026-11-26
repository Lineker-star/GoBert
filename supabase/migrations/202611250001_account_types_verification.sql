-- =============================================================================
-- GoBert platform v2: three account types, admin-gated verification, guest
-- booking, rentals, parcels, notifications and an admin API that requires 2FA.
--
-- Security model
--   * Users (incl. anonymous guests) only get SELECT on their own rows. Every
--     write goes through a SECURITY DEFINER function below that checks who is
--     calling — no client can write a table directly.
--   * is_admin() is true only for profiles.role = 'admin' AND an aal2 session
--     (password + authenticator-app code). Admin RPCs refuse anything else.
--   * Public provider data is served by functions that never expose private
--     columns; phone/WhatsApp are only returned to registered (non-guest) users
--     and only if the provider opted into direct calls.
--   * Fixes: "profiles self" (FOR ALL) let a user set role = 'admin';
--     "providers self write" (FOR ALL) let a provider approve themselves.
-- =============================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

do $$ begin
  create type provider_kind as enum ('rider', 'business');
exception when duplicate_object then null; end $$;

alter type verification_status add value if not exists 'changes_requested';

-- ----------------------------------------------------------------------------
-- Columns
-- ----------------------------------------------------------------------------
alter table profiles add column if not exists provider_kind provider_kind;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists city text default 'Bertoua';
alter table profiles add column if not exists is_blocked boolean not null default false;
create unique index if not exists profiles_user_id_key on profiles (user_id);

alter table providers add column if not exists owner_user_id uuid references auth.users (id) on delete set null;
alter table providers add column if not exists kind provider_kind not null default 'rider';
alter table providers add column if not exists phone text;
alter table providers add column if not exists city_name text default 'Bertoua';
alter table providers add column if not exists lat double precision;
alter table providers add column if not exists lng double precision;
alter table providers add column if not exists service text;
alter table providers add column if not exists services text[] not null default '{}';
alter table providers add column if not exists service_details jsonb not null default '[]';
alter table providers add column if not exists vehicle jsonb;
alter table providers add column if not exists business jsonb;
alter table providers add column if not exists schedule jsonb not null default '{"days":[1,2,3,4,5,6],"start":"06:00","end":"22:00","is_24h":false}';
alter table providers add column if not exists photo_url text;
alter table providers add column if not exists trips_completed int not null default 0;
alter table providers add column if not exists earnings_xaf int not null default 0;
alter table providers add column if not exists review_note text;
alter table providers add column if not exists submitted_at timestamptz;
alter table providers add column if not exists reviewed_at timestamptz;
alter table providers add column if not exists reviewed_by uuid;
alter table providers add column if not exists managed_by_admin boolean not null default false;
alter table providers add column if not exists claim_phone text;
create unique index if not exists providers_owner_key on providers (owner_user_id) where owner_user_id is not null;
create index if not exists providers_kind_status_idx on providers (kind, verification_status);
create index if not exists providers_online_idx on providers (is_online) where verification_status = 'approved';

alter table bookings add column if not exists passenger_user uuid references auth.users (id) on delete set null;
alter table bookings add column if not exists passenger_name text;
alter table bookings add column if not exists passenger_phone text;
alter table bookings add column if not exists declined_by uuid[] not null default '{}';
alter table bookings add column if not exists eta_min int;
alter table bookings add column if not exists pickup_lat double precision;
alter table bookings add column if not exists pickup_lng double precision;
alter table bookings add column if not exists dropoff_lat double precision;
alter table bookings add column if not exists dropoff_lng double precision;
alter table bookings add column if not exists accepted_at timestamptz;
alter table bookings add column if not exists arrived_at timestamptz;
alter table bookings add column if not exists started_at timestamptz;
alter table bookings add column if not exists completed_at timestamptz;
alter table bookings add column if not exists rating int check (rating between 1 and 5);
alter table bookings add column if not exists rating_comment text;
create index if not exists bookings_passenger_user_idx on bookings (passenger_user);
create index if not exists bookings_status_vtype_idx on bookings (status, vehicle_type);

alter table notifications add column if not exists kind text;
alter table notifications add column if not exists params jsonb not null default '{}';
alter table notifications add column if not exists read boolean not null default false;
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- New tables
-- ----------------------------------------------------------------------------
create table if not exists provider_applications (
  user_id uuid primary key references auth.users (id) on delete cascade,
  step int not null default 0,
  data jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  provider_id uuid references providers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rental_vehicles (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references providers (id) on delete cascade,
  type text not null check (type in ('car', 'truck', 'van', 'moto', 'tricycle')),
  brand text not null,
  model text not null,
  plate text not null,
  photo_url text,
  seats int,
  price_per_hour_xaf int not null default 0 check (price_per_hour_xaf >= 0),
  price_per_day_xaf int not null check (price_per_day_xaf > 0),
  with_driver boolean not null default false,
  deposit_xaf int not null default 0 check (deposit_xaf >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists rental_vehicles_provider_idx on rental_vehicles (provider_id);

create table if not exists rental_requests (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references rental_vehicles (id) on delete cascade,
  vehicle_label text not null,
  provider_id uuid not null references providers (id) on delete cascade,
  customer_user uuid references auth.users (id) on delete set null,
  customer_name text not null,
  phone text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  with_driver boolean not null default false,
  total_xaf int not null,
  deposit_xaf int not null default 0,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rental_requests_provider_idx on rental_requests (provider_id);
create index if not exists rental_requests_customer_idx on rental_requests (customer_user);

create table if not exists parcels (
  id uuid primary key default gen_random_uuid(),
  sender_user uuid references auth.users (id) on delete set null,
  sender_name text not null,
  sender_phone text not null,
  receiver_name text not null,
  receiver_phone text not null,
  pickup jsonb not null,
  dropoff jsonb not null,
  size text not null check (size in ('small', 'medium', 'large')),
  notes text,
  photo_url text,
  fare_xaf int not null,
  otp text not null,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'in_transit', 'delivered', 'cancelled')),
  provider_id uuid references providers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parcels_sender_idx on parcels (sender_user);
create index if not exists parcels_status_idx on parcels (status);

-- One-time codes that let a guest carry their bookings over to the account they create.
create table if not exists guest_transfers (
  code text primary key,
  guest_user uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from profiles where user_id = auth.uid() and role = 'admin' and not is_blocked);
$$;

create or replace function is_provider() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'provider');
$$;

-- Signed in with a real account (not an anonymous guest) and not blocked.
create or replace function is_registered() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and not exists (select 1 from profiles where user_id = auth.uid() and is_blocked);
$$;

create or replace function require_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if exists (select 1 from profiles where user_id = auth.uid() and is_blocked) then
    raise exception 'account blocked' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create or replace function require_registered() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_user();
  if not is_registered() then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  return auth.uid();
end $$;

create or replace function require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'admin with two-factor session required' using errcode = '42501';
  end if;
  return auth.uid();
end $$;

create or replace function my_provider_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from providers where owner_user_id = auth.uid();
$$;

create or replace function provider_is_approved(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from providers where id = p_id and verification_status = 'approved');
$$;

create or replace function mask_phone(p text) returns text
language sql immutable as $$
  select case when p is null then null
              when length(regexp_replace(p, '\s', '', 'g')) < 6 then '•••'
              else left(regexp_replace(p, '\s', '', 'g'), 5) || ' ••• ••' || right(p, 2) end;
$$;

create or replace function distance_m(alat double precision, alng double precision, blat double precision, blng double precision)
returns int language sql immutable as $$
  select round(st_distance(st_setsrid(st_makepoint(alng, alat), 4326)::geography,
                           st_setsrid(st_makepoint(blng, blat), 4326)::geography))::int;
$$;

create or replace function notify_user(p_user uuid, p_kind text, p_params jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, channel, kind, params, title, created_at)
  select p_user, 'in_app', p_kind, coalesce(p_params, '{}'), p_kind, now() where p_user is not null;
$$;

create or replace function audit(p_action text, p_entity text, p_entity_id uuid, p_diff jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor, action, entity, entity_id, diff) values (auth.uid(), p_action, p_entity, p_entity_id, p_diff);
$$;

-- ----------------------------------------------------------------------------
-- JSON shapes (mirror the web app's TypeScript types)
-- ----------------------------------------------------------------------------
create or replace function account_type(pr profiles) returns text
language sql immutable as $$
  select case when pr.role = 'provider' then coalesce(pr.provider_kind::text, 'rider')
              when pr.role = 'admin' then 'admin'
              else 'customer' end;
$$;

create or replace function user_json(pr profiles) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', pr.user_id, 'phone', coalesce(pr.phone, ''), 'full_name', coalesce(pr.full_name, ''),
    'role', account_type(pr), 'email', pr.email, 'city', coalesce(pr.city, 'Bertoua'),
    'language', coalesce(pr.language, 'fr'),
    'provider_id', (select id from providers where owner_user_id = pr.user_id),
    'is_blocked', pr.is_blocked,
    'created_at', pr.created_at, 'updated_at', pr.updated_at);
$$;

-- p_view: 'private' (owner/admin), 'registered' (signed-in user), 'guest'
create or replace function provider_json(p providers, p_view text default 'guest') returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'kind', p.kind, 'display_name', p.display_name,
    'owner_user_id', case when p_view = 'private' then p.owner_user_id end,
    'phone', case when p_view = 'private' then p.phone
                  when p_view = 'registered' and p.accepts_direct_calls then p.phone end,
    'whatsapp', case when p_view = 'private' then p.whatsapp
                     when p_view = 'registered' and p.accepts_direct_calls then p.whatsapp end,
    'city', coalesce(p.city_name, 'Bertoua'), 'bio', coalesce(p.bio, ''),
    'rating_avg', round(coalesce(p.rating_avg, 0)::numeric, 1), 'rating_count', coalesce(p.rating_count, 0),
    'trips_completed', p.trips_completed,
    'earnings_xaf', case when p_view = 'private' then p.earnings_xaf else 0 end,
    'accepts_direct_calls', coalesce(p.accepts_direct_calls, false), 'is_online', coalesce(p.is_online, false),
    'verification_status', p.verification_status,
    'review_note', case when p_view = 'private' then p.review_note end,
    'submitted_at', coalesce(p.submitted_at, p.created_at), 'reviewed_at', p.reviewed_at,
    'last_location', jsonb_build_object('lat', coalesce(p.lat, 4.5774), 'lng', coalesce(p.lng, 13.6846)),
    'service', coalesce(p.service, p.services[1], 'moto'), 'services', to_jsonb(p.services),
    'service_details', p.service_details, 'vehicle', p.vehicle, 'business', p.business,
    'schedule', p.schedule, 'photo', p.photo_url,
    'managed_by_admin', p.managed_by_admin, 'claim_phone', case when p_view = 'private' then p.claim_phone end);
$$;

create or replace function booking_json(b bookings) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'passenger_id', b.passenger_user, 'passenger_name', b.passenger_name,
    'passenger_phone', b.passenger_phone, 'provider_id', b.provider_id, 'declined_by', to_jsonb(b.declined_by),
    'vehicle_type', b.vehicle_type,
    'pickup', jsonb_build_object('lat', b.pickup_lat, 'lng', b.pickup_lng, 'label', coalesce(b.pickup_label, '')),
    'dropoff', jsonb_build_object('lat', b.dropoff_lat, 'lng', b.dropoff_lng, 'label', coalesce(b.dropoff_label, '')),
    'fare_estimate_xaf', b.fare_estimate_xaf, 'fare_final_xaf', b.fare_final_xaf,
    'distance_m', coalesce(b.distance_m, 0), 'eta_min', coalesce(b.eta_min, 0),
    'payment_method', b.payment_method, 'notes', b.notes, 'status', b.status,
    'created_at', b.created_at, 'updated_at', b.updated_at, 'accepted_at', b.accepted_at,
    'arrived_at', b.arrived_at, 'started_at', b.started_at, 'completed_at', b.completed_at,
    'rating', b.rating, 'rating_comment', b.rating_comment);
$$;

create or replace function rental_vehicle_json(v rental_vehicles) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(v) - 'created_at' || jsonb_build_object(
    'photo', v.photo_url,
    'provider_name', (select display_name from providers where id = v.provider_id));
$$;

create or replace function parcel_json(x parcels, p_with_otp boolean) returns jsonb
language sql stable security definer set search_path = public as $$
  select (to_jsonb(x) - 'otp' - 'sender_user' - 'photo_url') || jsonb_build_object(
    'sender_user_id', x.sender_user, 'photo', x.photo_url,
    'otp', case when p_with_otp then x.otp end);
$$;

-- ----------------------------------------------------------------------------
-- Row level security: read-only access to your own rows; writes via functions
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table providers enable row level security;
alter table provider_documents enable row level security;
alter table bookings enable row level security;
alter table ratings enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;
alter table provider_applications enable row level security;
alter table rental_vehicles enable row level security;
alter table rental_requests enable row level security;
alter table parcels enable row level security;
alter table guest_transfers enable row level security;
alter table ai_settings enable row level security;
alter table pricing_rules enable row level security;
alter table cities enable row level security;

drop policy if exists "profiles self" on profiles;
drop policy if exists "profiles admin read" on profiles;
drop policy if exists "providers public read approved" on providers;
drop policy if exists "providers self write" on providers;
drop policy if exists "providers admin all" on providers;
drop policy if exists "provider_documents owner" on provider_documents;
drop policy if exists "provider_documents admin" on provider_documents;
drop policy if exists "vehicles owner write" on vehicles;
drop policy if exists "services owner write" on services;
drop policy if exists "bookings own passenger" on bookings;
drop policy if exists "bookings provider read offered" on bookings;
drop policy if exists "bookings admin" on bookings;
drop policy if exists "ratings insert own" on ratings;

create policy "profiles read own" on profiles for select using (user_id = auth.uid() or is_admin());
create policy "providers read own" on providers for select using (owner_user_id = auth.uid() or is_admin());
create policy "documents read own" on provider_documents for select
  using (provider_id = my_provider_id() or is_admin());
create policy "bookings read own" on bookings for select
  using (passenger_user = auth.uid() or provider_id = my_provider_id() or is_admin());
create policy "notifications read own" on notifications for select using (user_id = auth.uid());
create policy "audit admin read" on audit_log for select using (is_admin());
create policy "applications read own" on provider_applications for select using (user_id = auth.uid() or is_admin());
create policy "rental vehicles public read" on rental_vehicles for select
  using ((available and provider_is_approved(provider_id)) or provider_id = my_provider_id() or is_admin());
create policy "rental requests read own" on rental_requests for select
  using (customer_user = auth.uid() or provider_id = my_provider_id() or is_admin());
create policy "parcels read own" on parcels for select
  using (sender_user = auth.uid() or provider_id = my_provider_id() or is_admin());
create policy "ai settings admin" on ai_settings for all using (is_admin()) with check (is_admin());
drop policy if exists "pricing read" on pricing_rules;
create policy "pricing read" on pricing_rules for select using (true);
drop policy if exists "pricing admin" on pricing_rules;
create policy "pricing admin" on pricing_rules for all using (is_admin()) with check (is_admin());
drop policy if exists "cities read" on cities;
create policy "cities read" on cities for select using (true);

-- The delivery code must never reach couriers: hide the column from direct reads.
revoke select on parcels from anon, authenticated;
grant select (id, sender_user, sender_name, sender_phone, receiver_name, receiver_phone, pickup, dropoff,
              size, notes, photo_url, fare_xaf, status, provider_id, created_at, updated_at)
  on parcels to authenticated;

-- The old definer views bypassed RLS; public data now comes from functions.
drop view if exists v_public_providers;
drop view if exists v_admin_verification_queue;
do $$ begin
  execute 'alter view if exists v_public_services set (security_invoker = true)';
  execute 'alter view if exists v_public_vehicles set (security_invoker = true)';
exception when others then null; end $$;

-- ----------------------------------------------------------------------------
-- Accounts
-- ----------------------------------------------------------------------------
create or replace function register_profile(p_account_type text, p_full_name text, p_email text default null,
                                            p_city text default 'Bertoua', p_language text default 'fr')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_registered();
  v_phone text;
  v_auth_email text;
  pr profiles;
begin
  if p_account_type not in ('customer', 'rider', 'business') then
    raise exception 'invalid account type';
  end if;
  if length(trim(coalesce(p_full_name, ''))) < 2 then raise exception 'full name required'; end if;
  select phone, email into v_phone, v_auth_email from auth.users where id = uid;
  v_phone := nullif(v_phone, '');
  if v_phone is not null and left(v_phone, 1) <> '+' then v_phone := '+' || v_phone; end if;

  select * into pr from profiles where user_id = uid;
  if found then
    -- The account type is chosen once and cannot be changed by the user.
    update profiles set full_name = trim(p_full_name), email = coalesce(nullif(trim(p_email), ''), email, v_auth_email),
           city = coalesce(nullif(p_city, ''), city), language = coalesce(nullif(p_language, ''), language), updated_at = now()
     where user_id = uid returning * into pr;
  else
    insert into profiles (user_id, role, provider_kind, full_name, phone, email, city, language)
    values (uid,
            case when p_account_type = 'customer' then 'passenger'::user_role else 'provider'::user_role end,
            case when p_account_type = 'customer' then null else p_account_type::provider_kind end,
            trim(p_full_name), v_phone, coalesce(nullif(trim(p_email), ''), v_auth_email), coalesce(nullif(p_city, ''), 'Bertoua'),
            coalesce(nullif(p_language, ''), 'fr'))
    returning * into pr;
    -- Claim a provider profile an admin created for this phone number.
    if p_account_type <> 'customer' and v_phone is not null then
      update providers set owner_user_id = uid, profile_id = pr.id
       where owner_user_id is null and claim_phone = v_phone and kind = p_account_type::provider_kind;
    end if;
  end if;
  return user_json(pr);
end $$;

create or replace function update_profile(p_full_name text default null, p_email text default null,
                                          p_city text default null, p_language text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := require_registered(); pr profiles;
begin
  if p_email is not null and p_email <> '' and p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'invalid email'; end if;
  update profiles set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    email = case when p_email is null then email else nullif(trim(p_email), '') end,
    city = coalesce(nullif(p_city, ''), city),
    language = case when p_language in ('fr', 'en') then p_language else language end,
    updated_at = now()
  where user_id = uid returning * into pr;
  if not found then raise exception 'profile not found'; end if;
  update providers set display_name = pr.full_name where owner_user_id = uid and kind = 'rider' and p_full_name is not null;
  return user_json(pr);
end $$;

create or replace function my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select user_json(pr) from profiles pr where pr.user_id = auth.uid();
$$;

create or replace function my_account() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pr profiles; p providers;
begin
  select * into pr from profiles where user_id = auth.uid();
  if not found then return null; end if;
  select * into p from providers where owner_user_id = auth.uid();
  return jsonb_build_object(
    'user', user_json(pr),
    'provider', case when p.id is null then null else provider_json(p, 'private') end,
    'draft', (select jsonb_build_object('id', a.user_id, 'user_id', a.user_id, 'step', a.step, 'data', a.data,
                                        'status', a.status, 'provider_id', a.provider_id,
                                        'created_at', a.created_at, 'updated_at', a.updated_at)
                from provider_applications a where a.user_id = auth.uid()),
    'fleet', coalesce((select jsonb_agg(rental_vehicle_json(v) order by v.created_at) from rental_vehicles v where v.provider_id = p.id), '[]'));
end $$;

-- Guest → account: the guest asks for a code, the new account redeems it.
create or replace function create_guest_transfer() returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_user(); v_code text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if is_registered() then return null; end if;
  delete from guest_transfers where guest_user = uid or expires_at < now();
  insert into guest_transfers (code, guest_user) values (v_code, uid);
  return v_code;
end $$;

create or replace function redeem_guest_transfer(p_code text) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_registered(); g uuid; n int := 0; c int;
begin
  delete from guest_transfers where code = p_code and expires_at > now() returning guest_user into g;
  if g is null or g = uid then return 0; end if;
  update bookings set passenger_user = uid where passenger_user = g; get diagnostics c = row_count; n := n + c;
  update rental_requests set customer_user = uid where customer_user = g; get diagnostics c = row_count; n := n + c;
  update parcels set sender_user = uid where sender_user = g; get diagnostics c = row_count; n := n + c;
  return n;
end $$;

create or replace function my_notifications() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'user_id', n.user_id, 'kind', n.kind,
                                               'params', n.params, 'at', n.created_at, 'read', n.read)
                            order by n.created_at desc), '[]')
    from (select * from notifications where user_id = auth.uid() order by created_at desc limit 30) n;
$$;

create or replace function mark_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read = true where user_id = auth.uid() and not read;
$$;

-- ----------------------------------------------------------------------------
-- Provider onboarding
-- ----------------------------------------------------------------------------
create or replace function save_application(p_step int, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_registered(); a provider_applications;
begin
  if not exists (select 1 from profiles where user_id = uid and role = 'provider') then
    raise exception 'only rider and service provider accounts can apply';
  end if;
  if pg_column_size(p_data) > 200000 then raise exception 'application too large'; end if;
  insert into provider_applications (user_id, step, data)
  values (uid, coalesce(p_step, 0), coalesce(p_data, '{}'))
  on conflict (user_id) do update
    set step = excluded.step, data = provider_applications.data || excluded.data, updated_at = now()
  returning * into a;
  return jsonb_build_object('id', a.user_id, 'user_id', a.user_id, 'step', a.step, 'data', a.data, 'status', a.status,
                            'provider_id', a.provider_id, 'created_at', a.created_at, 'updated_at', a.updated_at);
end $$;

create or replace function validate_application(d jsonb, k provider_kind) returns text[]
language plpgsql immutable set search_path = public as $$
declare missing text[] := '{}'; docs jsonb := coalesce(d -> 'documents', '[]'); t text;
begin
  if coalesce(trim(d ->> 'full_name'), '') = '' then missing := array_append(missing, 'full_name'); end if;
  if coalesce(trim(d ->> 'phone'), '') = '' then missing := array_append(missing, 'phone'); end if;
  if k = 'rider' then
    if coalesce(d ->> 'vehicle_type', '') not in ('moto', 'taxi', 'tricycle', 'truck') then missing := array_append(missing, 'vehicle_type'); end if;
    if length(coalesce(trim(d ->> 'plate'), '')) < 4 then missing := array_append(missing, 'plate'); end if;
    foreach t in array array['id_card', 'license', 'registration'] loop
      if not exists (select 1 from jsonb_array_elements(docs) e where e ->> 'type' = t) then missing := array_append(missing, 'doc:' || t); end if;
    end loop;
  else
    if coalesce(trim(d ->> 'business_name'), '') = '' then missing := array_append(missing, 'business_name'); end if;
    if coalesce(d ->> 'business_type', '') not in ('delivery', 'car_rental', 'logistics', 'other') then missing := array_append(missing, 'business_type'); end if;
    if coalesce(trim(d ->> 'registration_number'), '') = '' then missing := array_append(missing, 'registration_number'); end if;
    foreach t in array array['business_registration', 'manager_id'] loop
      if not exists (select 1 from jsonb_array_elements(docs) e where e ->> 'type' = t) then missing := array_append(missing, 'doc:' || t); end if;
    end loop;
  end if;
  if jsonb_array_length(coalesce(d -> 'services', '[]')) = 0 then missing := array_append(missing, 'services'); end if;
  return missing;
end $$;

-- Shared by owner submission and admin creation: writes a provider row from application data.
create or replace function upsert_provider_from_data(p_id uuid, d jsonb, k provider_kind, p_owner uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_services text[];
  v_vtype text := d ->> 'vehicle_type';
  v_primary text;
  v_id uuid := p_id;
  f jsonb;
begin
  select coalesce(array_agg(distinct s ->> 'type'), '{}') into v_services from jsonb_array_elements(coalesce(d -> 'services', '[]')) s;
  v_primary := case when k = 'rider' then case v_vtype when 'moto' then 'moto' when 'taxi' then 'ride' when 'truck' then 'cargo' else 'express' end
                    else case d ->> 'business_type' when 'delivery' then 'express' when 'car_rental' then 'rent' when 'logistics' then 'logistics' else 'cargo' end end;
  if not v_primary = any (v_services) then v_primary := coalesce(v_services[1], v_primary); end if;

  if v_id is null then
    insert into providers (owner_user_id, kind, verification_status) values (p_owner, k, 'draft') returning id into v_id;
  end if;

  update providers set
    kind = k,
    display_name = coalesce(nullif(trim(case when k = 'business' then d ->> 'business_name' else d ->> 'full_name' end), ''), 'GoBert'),
    phone = nullif(trim(d ->> 'phone'), ''),
    whatsapp = nullif(trim(d ->> 'whatsapp'), ''),
    city_name = coalesce(nullif(d ->> 'city', ''), 'Bertoua'),
    bio = coalesce(case when k = 'business' then d ->> 'description' else d ->> 'bio' end, ''),
    accepts_direct_calls = coalesce((d ->> 'accepts_direct_calls')::boolean, true),
    services = v_services,
    service = v_primary,
    service_details = coalesce(d -> 'services', '[]'),
    vehicle = case when k = 'rider' then jsonb_build_object(
      'type', v_vtype, 'brand', coalesce(d ->> 'brand', ''), 'model', coalesce(d ->> 'model', ''),
      'plate', upper(coalesce(trim(d ->> 'plate'), '')), 'color', coalesce(d ->> 'color', ''),
      'year', (d ->> 'year')::int, 'seats', (d ->> 'seats')::int, 'payload_kg', (d ->> 'payload_kg')::int) end,
    business = case when k = 'business' then jsonb_build_object(
      'name', coalesce(d ->> 'business_name', ''), 'type', coalesce(d ->> 'business_type', 'other'),
      'registration_number', coalesce(d ->> 'registration_number', ''), 'tax_id', coalesce(d ->> 'tax_id', ''),
      'address', coalesce(d ->> 'address', ''), 'description', coalesce(d ->> 'description', '')) end,
    schedule = coalesce(d -> 'schedule', schedule),
    photo_url = coalesce(d ->> 'vehicle_photo_url', photo_url),
    lat = coalesce(lat, 4.5774), lng = coalesce(lng, 13.6846),
    updated_at = now()
  where id = v_id;

  -- documents (storage paths in the private provider-docs bucket)
  if d ? 'documents' then
    delete from provider_documents where provider_id = v_id;
    insert into provider_documents (provider_id, doc_type, storage_path, status)
    select v_id, e ->> 'type', coalesce(e ->> 'storage_path', e ->> 'data_url'), 'pending'
      from jsonb_array_elements(d -> 'documents') e;
  end if;

  -- business fleet
  if k = 'business' and jsonb_array_length(coalesce(d -> 'fleet', '[]')) > 0 then
    delete from rental_vehicles where provider_id = v_id;
    for f in select * from jsonb_array_elements(d -> 'fleet') loop
      insert into rental_vehicles (provider_id, type, brand, model, plate, seats, price_per_hour_xaf, price_per_day_xaf, with_driver, deposit_xaf, photo_url)
      values (v_id, f ->> 'type', f ->> 'brand', f ->> 'model', upper(f ->> 'plate'), (f ->> 'seats')::int,
              coalesce((f ->> 'price_per_hour_xaf')::int, 0), greatest(1, coalesce((f ->> 'price_per_day_xaf')::int, 1)),
              coalesce((f ->> 'with_driver')::boolean, false), coalesce((f ->> 'deposit_xaf')::int, 0), f ->> 'photo_url');
    end loop;
    if not 'rent' = any (v_services) then update providers set services = array_append(services, 'rent') where id = v_id; end if;
  end if;
  return v_id;
end $$;

create or replace function submit_application() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := require_registered();
  pr profiles; a provider_applications; p providers; v_id uuid; missing text[];
begin
  select * into pr from profiles where user_id = uid;
  if pr.role <> 'provider' then raise exception 'only rider and service provider accounts can apply'; end if;
  select * into a from provider_applications where user_id = uid;
  if not found then raise exception 'no application'; end if;
  missing := validate_application(a.data, pr.provider_kind);
  if array_length(missing, 1) > 0 then
    raise exception 'incomplete' using detail = array_to_string(missing, ','), errcode = 'P0001', hint = 'incomplete';
  end if;
  select * into p from providers where owner_user_id = uid;
  if found and p.verification_status not in ('draft', 'changes_requested', 'rejected') then
    raise exception 'application already submitted';
  end if;
  v_id := upsert_provider_from_data(p.id, a.data, pr.provider_kind, uid);
  update providers set verification_status = 'pending', submitted_at = now(), review_note = null, is_online = false,
         profile_id = pr.id where id = v_id;
  update provider_applications set status = 'submitted', provider_id = v_id, updated_at = now() where user_id = uid;
  perform notify_user(uid, 'provider_submitted', jsonb_build_object('name', (select display_name from providers where id = v_id)));
  perform audit('submit', 'provider', v_id);
  select * into p from providers where id = v_id;
  return provider_json(p, 'private');
end $$;

-- ----------------------------------------------------------------------------
-- Public directory (approved only)
-- ----------------------------------------------------------------------------
create or replace function list_public_providers(p_online boolean default false, p_service text default null, p_kind text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(provider_json(p, case when is_registered() then 'registered' else 'guest' end)
                            order by p.is_online desc, p.rating_avg desc), '[]')
    from providers p
   where p.verification_status = 'approved'
     and (not p_online or p.is_online)
     and (p_service is null or p_service = any (p.services))
     and (p_kind is null or p.kind::text = p_kind);
$$;

create or replace function get_public_provider(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p.owner_user_id = auth.uid() or is_admin() then provider_json(p, 'private')
              else provider_json(p, case when is_registered() then 'registered' else 'guest' end) end
    from providers p where p.id = p_id and (p.verification_status = 'approved' or p.owner_user_id = auth.uid() or is_admin());
$$;

-- Offers and reviews of one provider: registered users only ("sign in to see more").
create or replace function provider_offers(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_registered();
  if not provider_is_approved(p_id) then return null; end if;
  return jsonb_build_object(
    'provider', (select provider_json(p, 'registered') from providers p where p.id = p_id),
    'fleet', coalesce((select jsonb_agg(rental_vehicle_json(v)) from rental_vehicles v where v.provider_id = p_id and v.available), '[]'),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('stars', b.rating, 'comment', b.rating_comment, 'at', b.completed_at)
                                          order by b.completed_at desc)
                           from (select * from bookings where provider_id = p_id and rating is not null order by completed_at desc limit 20) b), '[]'));
end $$;

create or replace function set_online(p_online boolean, p_lat double precision default null, p_lng double precision default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := require_registered(); p providers;
begin
  select * into p from providers where owner_user_id = uid;
  if not found then return false; end if;
  if p_online and p.verification_status <> 'approved' then return false; end if;
  update providers set is_online = p_online, last_seen_at = now(),
         lat = coalesce(p_lat, lat), lng = coalesce(p_lng, lng),
         last_location = case when p_lat is not null and p_lng is not null
                              then st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography else last_location end
   where id = p.id;
  return true;
end $$;

create or replace function update_provider_settings(p_accepts_direct_calls boolean default null, p_whatsapp text default null, p_bio text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := require_registered(); p providers;
begin
  update providers set
    accepts_direct_calls = coalesce(p_accepts_direct_calls, accepts_direct_calls),
    whatsapp = coalesce(p_whatsapp, whatsapp), bio = coalesce(p_bio, bio), updated_at = now()
   where owner_user_id = uid returning * into p;
  if not found then raise exception 'no provider'; end if;
  return provider_json(p, 'private');
end $$;

-- ----------------------------------------------------------------------------
-- Trips (dispatch)
-- ----------------------------------------------------------------------------
create or replace function estimate_trip(p_plat double precision, p_plng double precision, p_dlat double precision, p_dlng double precision,
                                         p_vtype text, p_distance_m int default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d int := coalesce(p_distance_m, distance_m(p_plat, p_plng, p_dlat, p_dlng));
  km numeric := d / 1000.0;
  minutes int := greatest(2, round(km / 25 * 60));
  r record;
  fare int;
begin
  select base_fare, per_km, per_min, min_fare into r from pricing_rules
   where vehicle_type::text = p_vtype order by updated_at desc nulls last limit 1;
  if not found then
    select * into r from (values
      ('moto', 300, 100, 25, 500), ('taxi', 500, 150, 30, 800), ('tricycle', 400, 120, 25, 600), ('truck', 1000, 300, 50, 2000)
    ) as t(vt, base_fare, per_km, per_min, min_fare) where vt = p_vtype;
  end if;
  if r is null then raise exception 'unknown vehicle type'; end if;
  fare := greatest(r.min_fare, round((r.base_fare + r.per_km * km + r.per_min * minutes) / 25.0) * 25);
  return jsonb_build_object('fare_estimate_xaf', fare, 'distance_m', d, 'eta_min', minutes);
end $$;

create or replace function create_trip(p_vtype text, p_pickup jsonb, p_dropoff jsonb, p_payment text default 'cash',
                                       p_passenger_name text default null, p_passenger_phone text default null,
                                       p_notes text default null, p_distance_m int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := require_user(); est jsonb; b bookings;
begin
  if p_vtype not in ('moto', 'taxi', 'tricycle', 'truck') then raise exception 'invalid vehicle type'; end if;
  if p_payment not in ('cash', 'mtn_momo', 'orange_money') then p_payment := 'cash'; end if;
  if (p_pickup ->> 'lat') is null or (p_dropoff ->> 'lat') is null then raise exception 'pickup and destination required'; end if;
  if (select count(*) from bookings where passenger_user = uid and status = 'requested') >= 2 then
    raise exception 'you already have a pending request';
  end if;
  est := estimate_trip((p_pickup ->> 'lat')::float8, (p_pickup ->> 'lng')::float8, (p_dropoff ->> 'lat')::float8, (p_dropoff ->> 'lng')::float8, p_vtype, p_distance_m);
  insert into bookings (passenger_user, passenger_name, passenger_phone, vehicle_type, pickup_lat, pickup_lng, pickup_label,
                        dropoff_lat, dropoff_lng, dropoff_label, pickup, dropoff, status, fare_estimate_xaf, distance_m, eta_min,
                        payment_method, notes)
  values (uid, nullif(trim(p_passenger_name), ''), nullif(trim(p_passenger_phone), ''), p_vtype::vehicle_type,
          (p_pickup ->> 'lat')::float8, (p_pickup ->> 'lng')::float8, left(coalesce(p_pickup ->> 'label', ''), 200),
          (p_dropoff ->> 'lat')::float8, (p_dropoff ->> 'lng')::float8, left(coalesce(p_dropoff ->> 'label', ''), 200),
          st_setsrid(st_makepoint((p_pickup ->> 'lng')::float8, (p_pickup ->> 'lat')::float8), 4326)::geography,
          st_setsrid(st_makepoint((p_dropoff ->> 'lng')::float8, (p_dropoff ->> 'lat')::float8), 4326)::geography,
          'requested', (est ->> 'fare_estimate_xaf')::int, (est ->> 'distance_m')::int, (est ->> 'eta_min')::int,
          p_payment::payment_method, left(p_notes, 300))
  returning * into b;
  insert into booking_events (booking_id, status, actor) values (b.id, 'requested', uid::text);
  return booking_json(b) || jsonb_build_object('provider', null, 'provider_phone', null);
end $$;

create or replace function expire_stale_trips() returns int
language sql security definer set search_path = public as $$
  with x as (update bookings set status = 'expired', updated_at = now()
              where status = 'requested' and created_at < now() - interval '2 minutes' returning 1)
  select count(*)::int from x;
$$;

-- Customer view of a trip: rider details and phone only once a rider accepted.
create or replace function get_trip(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bookings; p providers; revealed boolean;
begin
  perform expire_stale_trips();
  select * into b from bookings where id = p_id;
  if not found then return null; end if;
  if not (b.passenger_user = auth.uid() or b.provider_id = my_provider_id() or is_admin()) then return null; end if;
  select * into p from providers where id = b.provider_id;
  revealed := b.status in ('accepted', 'arriving', 'in_progress', 'completed');
  return booking_json(b) || jsonb_build_object(
    'provider', case when p.id is null then null else provider_json(p, 'guest') end,
    'provider_phone', case when revealed then p.phone end);
end $$;

create or replace function my_trips() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(booking_json(b) || jsonb_build_object(
           'provider', (select provider_json(p, 'guest') from providers p where p.id = b.provider_id),
           'provider_phone', null) order by b.created_at desc), '[]')
    from bookings b where b.passenger_user = auth.uid();
$$;

create or replace function provider_trips() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(booking_json(b) order by b.created_at desc), '[]')
    from bookings b where b.provider_id = my_provider_id() and my_provider_id() is not null;
$$;

create or replace function incoming_requests() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p providers;
begin
  perform expire_stale_trips();
  select * into p from providers where owner_user_id = auth.uid();
  if not found or p.verification_status <> 'approved' or not p.is_online or p.vehicle is null then return '[]'; end if;
  return coalesce((select jsonb_agg(booking_json(b) || jsonb_build_object('passenger_phone', mask_phone(b.passenger_phone)) order by b.created_at)
                     from bookings b
                    where b.status = 'requested' and b.provider_id is null
                      and not (p.id = any (b.declined_by))
                      and b.vehicle_type::text = p.vehicle ->> 'type'
                      and distance_m(coalesce(p.lat, 4.5774), coalesce(p.lng, 13.6846), b.pickup_lat, b.pickup_lng) < 8000), '[]');
end $$;

create or replace function accept_trip(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare p providers; b bookings;
begin
  perform require_registered();
  select * into p from providers where owner_user_id = auth.uid();
  if not found or p.verification_status <> 'approved' or not p.is_online then return false; end if;
  select * into b from bookings where id = p_id for update;          -- row lock: single winner
  if not found or b.status <> 'requested' or b.provider_id is not null then return false; end if;
  update bookings set provider_id = p.id, status = 'accepted', accepted_at = now(), updated_at = now() where id = p_id;
  insert into booking_events (booking_id, status, actor) values (p_id, 'accepted', p.id::text);
  perform notify_user(b.passenger_user, 'booking_accepted', jsonb_build_object('provider', p.display_name));
  return true;
end $$;

create or replace function decline_trip(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid := my_provider_id();
begin
  if pid is null then return; end if;
  update bookings set declined_by = array_append(declined_by, pid), updated_at = now()
   where id = p_id and status = 'requested' and not (pid = any (declined_by));
end $$;

create or replace function set_trip_status(p_id uuid, p_status text) returns boolean
language plpgsql security definer set search_path = public as $$
declare b bookings; pid uuid := my_provider_id(); is_passenger boolean; is_rider boolean;
begin
  perform require_user();
  select * into b from bookings where id = p_id for update;
  if not found then return false; end if;
  is_passenger := b.passenger_user = auth.uid();
  is_rider := pid is not null and b.provider_id = pid;
  if p_status = 'cancelled' and (is_passenger or is_rider or is_admin()) and b.status in ('requested', 'accepted', 'arriving') then
    update bookings set status = 'cancelled', updated_at = now() where id = p_id;
  elsif is_rider and p_status = 'arriving' and b.status = 'accepted' then
    update bookings set status = 'arriving', arrived_at = now(), updated_at = now() where id = p_id;
  elsif is_rider and p_status = 'in_progress' and b.status in ('accepted', 'arriving') then
    update bookings set status = 'in_progress', started_at = now(), updated_at = now() where id = p_id;
  elsif is_rider and p_status = 'completed' and b.status in ('arriving', 'in_progress') then
    update bookings set status = 'completed', completed_at = now(), fare_final_xaf = fare_estimate_xaf, updated_at = now() where id = p_id;
    update providers set trips_completed = trips_completed + 1, earnings_xaf = earnings_xaf + b.fare_estimate_xaf where id = pid;
  else
    return false;
  end if;
  insert into booking_events (booking_id, status, actor) values (p_id, p_status::booking_status, auth.uid()::text);
  return true;
end $$;

-- Rating requires a real account: guests are asked to sign in first.
create or replace function rate_trip(p_id uuid, p_stars int, p_comment text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_registered(); b bookings; s int := greatest(1, least(5, p_stars));
begin
  select * into b from bookings where id = p_id for update;
  if not found or b.passenger_user <> uid or b.status <> 'completed' then return false; end if;
  update providers set
    rating_count = rating_count + case when b.rating is null then 1 else 0 end,
    rating_avg = round(((coalesce(rating_avg, 0) * rating_count - coalesce(b.rating, 0) + s)
                        / greatest(1, rating_count + case when b.rating is null then 1 else 0 end))::numeric, 2)
   where id = b.provider_id;
  update bookings set rating = s, rating_comment = left(p_comment, 500), updated_at = now() where id = p_id;
  insert into ratings (booking_id, from_id, to_id, stars, comment)
  values (p_id, uid, b.provider_id, s, left(p_comment, 500));
  return true;
end $$;

-- ----------------------------------------------------------------------------
-- Rentals
-- ----------------------------------------------------------------------------
create or replace function list_rentals() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(rental_vehicle_json(v) order by v.price_per_day_xaf), '[]')
    from rental_vehicles v where v.available and provider_is_approved(v.provider_id);
$$;

create or replace function create_rental_request(p_vehicle uuid, p_name text, p_phone text, p_start date, p_end date, p_with_driver boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := require_user(); v rental_vehicles; r rental_requests;
begin
  select * into v from rental_vehicles where id = p_vehicle;
  if not found or not v.available or not provider_is_approved(v.provider_id) then raise exception 'vehicle unavailable'; end if;
  if p_end < p_start or p_start < current_date then raise exception 'invalid dates'; end if;
  if length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 8 then raise exception 'phone required'; end if;
  insert into rental_requests (vehicle_id, vehicle_label, provider_id, customer_user, customer_name, phone, start_date, end_date,
                               with_driver, total_xaf, deposit_xaf)
  values (v.id, v.brand || ' ' || v.model, v.provider_id, uid, coalesce(nullif(trim(p_name), ''), 'Client'), trim(p_phone),
          p_start, p_end, coalesce(p_with_driver, false), (p_end - p_start + 1) * v.price_per_day_xaf, v.deposit_xaf)
  returning * into r;
  perform notify_user((select owner_user_id from providers where id = v.provider_id), 'rental_requested',
                      jsonb_build_object('vehicle', r.vehicle_label, 'customer', r.customer_name));
  return to_jsonb(r) || jsonb_build_object('customer_user_id', r.customer_user);
end $$;

create or replace function get_rental_request(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(r) || jsonb_build_object('customer_user_id', r.customer_user)
    from rental_requests r where r.id = p_id and (r.customer_user = auth.uid() or r.provider_id = my_provider_id() or is_admin());
$$;

create or replace function my_rental_requests() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('customer_user_id', r.customer_user) order by r.created_at desc), '[]')
    from rental_requests r where r.customer_user = auth.uid();
$$;

create or replace function provider_rental_requests() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('customer_user_id', r.customer_user) order by r.created_at desc), '[]')
    from rental_requests r where r.provider_id = my_provider_id() and my_provider_id() is not null;
$$;

create or replace function respond_rental(p_id uuid, p_confirm boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare r rental_requests;
begin
  perform require_registered();
  update rental_requests set status = case when p_confirm then 'confirmed' else 'declined' end, updated_at = now()
   where id = p_id and provider_id = my_provider_id() and status = 'requested' returning * into r;
  if not found then return false; end if;
  perform notify_user(r.customer_user, case when p_confirm then 'rental_confirmed' else 'rental_declined' end,
                      jsonb_build_object('vehicle', r.vehicle_label));
  return true;
end $$;

create or replace function set_rental_status(p_id uuid, p_status text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r rental_requests;
begin
  perform require_user();
  if p_status = 'cancelled' then
    update rental_requests set status = 'cancelled', updated_at = now()
     where id = p_id and customer_user = auth.uid() and status in ('requested', 'confirmed') returning * into r;
  elsif p_status = 'active' then
    update rental_requests set status = 'active', updated_at = now()
     where id = p_id and provider_id = my_provider_id() and status = 'confirmed' returning * into r;
  elsif p_status = 'completed' then
    update rental_requests set status = 'completed', updated_at = now()
     where id = p_id and provider_id = my_provider_id() and status = 'active' returning * into r;
    if found then
      update providers set trips_completed = trips_completed + 1, earnings_xaf = earnings_xaf + r.total_xaf where id = r.provider_id;
    end if;
  end if;
  return r.id is not null;
end $$;

create or replace function add_fleet_vehicle(f jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid := my_provider_id(); v rental_vehicles;
begin
  perform require_registered();
  if pid is null or (select kind from providers where id = pid) <> 'business' then raise exception 'business account required'; end if;
  insert into rental_vehicles (provider_id, type, brand, model, plate, seats, price_per_hour_xaf, price_per_day_xaf, with_driver, deposit_xaf, photo_url)
  values (pid, f ->> 'type', trim(f ->> 'brand'), trim(f ->> 'model'), upper(trim(f ->> 'plate')), (f ->> 'seats')::int,
          coalesce((f ->> 'price_per_hour_xaf')::int, 0), (f ->> 'price_per_day_xaf')::int, coalesce((f ->> 'with_driver')::boolean, false),
          coalesce((f ->> 'deposit_xaf')::int, 0), f ->> 'photo_url')
  returning * into v;
  update providers set services = array_append(services, 'rent') where id = pid and not 'rent' = any (services);
  return rental_vehicle_json(v);
end $$;

create or replace function update_fleet_vehicle(p_id uuid, f jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v rental_vehicles;
begin
  update rental_vehicles set
    available = coalesce((f ->> 'available')::boolean, available),
    with_driver = coalesce((f ->> 'with_driver')::boolean, with_driver),
    price_per_day_xaf = coalesce(nullif((f ->> 'price_per_day_xaf')::int, 0), price_per_day_xaf),
    price_per_hour_xaf = coalesce((f ->> 'price_per_hour_xaf')::int, price_per_hour_xaf)
   where id = p_id and (provider_id = my_provider_id() or is_admin()) returning * into v;
  if not found then raise exception 'not found'; end if;
  return rental_vehicle_json(v);
end $$;

create or replace function remove_fleet_vehicle(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from rental_vehicles where id = p_id and (provider_id = my_provider_id() or is_admin());
  return found;
end $$;

-- ----------------------------------------------------------------------------
-- Parcels (GoBert Express)
-- ----------------------------------------------------------------------------
create or replace function create_parcel(x jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := require_user(); d int; base int; per_km int; r parcels;
begin
  if coalesce(x ->> 'size', '') not in ('small', 'medium', 'large') then x := x || '{"size":"small"}'; end if;
  if coalesce(trim(x ->> 'sender_name'), '') = '' or coalesce(trim(x ->> 'receiver_name'), '') = ''
     or coalesce(trim(x ->> 'sender_phone'), '') = '' or coalesce(trim(x ->> 'receiver_phone'), '') = '' then
    raise exception 'sender and receiver required';
  end if;
  d := distance_m((x -> 'pickup' ->> 'lat')::float8, (x -> 'pickup' ->> 'lng')::float8, (x -> 'dropoff' ->> 'lat')::float8, (x -> 'dropoff' ->> 'lng')::float8);
  base := case x ->> 'size' when 'small' then 500 when 'medium' then 1000 else 2000 end;
  per_km := case when x ->> 'size' = 'large' then 200 else 100 end;
  insert into parcels (sender_user, sender_name, sender_phone, receiver_name, receiver_phone, pickup, dropoff, size, notes, photo_url, fare_xaf, otp)
  values (uid, trim(x ->> 'sender_name'), trim(x ->> 'sender_phone'), trim(x ->> 'receiver_name'), trim(x ->> 'receiver_phone'),
          x -> 'pickup', x -> 'dropoff', x ->> 'size', left(x ->> 'notes', 300), x ->> 'photo_url',
          round((base + d / 1000.0 * per_km) / 25.0) * 25, lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'))
  returning * into r;
  return parcel_json(r, true);
end $$;

create or replace function get_parcel(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select parcel_json(x, x.sender_user = auth.uid())
    from parcels x where x.id = p_id and (x.sender_user = auth.uid() or x.provider_id = my_provider_id() or is_admin());
$$;

create or replace function my_parcels() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(parcel_json(x, true) order by x.created_at desc), '[]') from parcels x where x.sender_user = auth.uid();
$$;

-- Open jobs + own deliveries, for approved providers offering Express.
create or replace function provider_parcels() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p providers;
begin
  select * into p from providers where owner_user_id = auth.uid();
  if not found or p.verification_status <> 'approved' or not 'express' = any (p.services) then return '[]'; end if;
  return coalesce((select jsonb_agg(parcel_json(x, false) order by x.created_at desc) from parcels x
                    where x.status = 'requested' or (x.provider_id = p.id and x.status <> 'cancelled')), '[]');
end $$;

create or replace function accept_parcel(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare p providers; r parcels;
begin
  select * into p from providers where owner_user_id = auth.uid();
  if not found or p.verification_status <> 'approved' or not 'express' = any (p.services) then return false; end if;
  update parcels set provider_id = p.id, status = 'accepted', updated_at = now()
   where id = p_id and status = 'requested' returning * into r;
  if not found then return false; end if;
  perform notify_user(r.sender_user, 'parcel_accepted', jsonb_build_object('provider', p.display_name));
  return true;
end $$;

create or replace function pickup_parcel(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update parcels set status = 'in_transit', updated_at = now()
   where id = p_id and provider_id = my_provider_id() and status = 'accepted';
  return found;
end $$;

create or replace function deliver_parcel(p_id uuid, p_otp text) returns boolean
language plpgsql security definer set search_path = public as $$
declare r parcels;
begin
  update parcels set status = 'delivered', updated_at = now()
   where id = p_id and provider_id = my_provider_id() and status in ('accepted', 'in_transit') and otp = trim(p_otp)
  returning * into r;
  if not found then return false; end if;
  update providers set trips_completed = trips_completed + 1, earnings_xaf = earnings_xaf + r.fare_xaf where id = r.provider_id;
  perform notify_user(r.sender_user, 'parcel_delivered', jsonb_build_object('receiver', r.receiver_name));
  return true;
end $$;

-- ----------------------------------------------------------------------------
-- Admin (all require an aal2 admin session)
-- ----------------------------------------------------------------------------
create or replace function am_i_admin() returns boolean
language sql stable security definer set search_path = public as $$ select is_admin(); $$;

create or replace function admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return jsonb_build_object(
    'overview', jsonb_build_object(
      'pending', (select count(*) from providers where verification_status = 'pending'),
      'approved', (select count(*) from providers where verification_status = 'approved'),
      'active', (select count(*) from providers where verification_status = 'approved' and is_online),
      'bookings_today', (select count(*) from bookings where created_at::date = (now() at time zone 'Africa/Douala')::date),
      'completed_today', (select count(*) from bookings where status = 'completed' and completed_at::date = (now() at time zone 'Africa/Douala')::date),
      'revenue_today_xaf', (select coalesce(sum(fare_final_xaf), 0) from bookings where status = 'completed' and completed_at::date = (now() at time zone 'Africa/Douala')::date),
      'rentals_open', (select count(*) from rental_requests where status = 'requested'),
      'parcels_open', (select count(*) from parcels where status not in ('delivered', 'cancelled')),
      'riders', jsonb_build_object('total', (select count(*) from providers where kind = 'rider'),
                                   'pending', (select count(*) from providers where kind = 'rider' and verification_status = 'pending'),
                                   'approved', (select count(*) from providers where kind = 'rider' and verification_status = 'approved')),
      'businesses', jsonb_build_object('total', (select count(*) from providers where kind = 'business'),
                                       'pending', (select count(*) from providers where kind = 'business' and verification_status = 'pending'),
                                       'approved', (select count(*) from providers where kind = 'business' and verification_status = 'approved')),
      'users', jsonb_build_object('total', (select count(*) from profiles where role <> 'admin'),
                                  'customer', (select count(*) from profiles where role = 'passenger'),
                                  'rider', (select count(*) from profiles where role = 'provider' and provider_kind = 'rider'),
                                  'business', (select count(*) from profiles where role = 'provider' and provider_kind = 'business'))),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'provider_id', a.entity_id, 'decision', a.action,
                                                          'reason', a.diff ->> 'reason', 'at', a.created_at) order by a.created_at)
                         from (select * from audit_log where entity = 'provider' order by created_at desc limit 20) a), '[]'));
end $$;

create or replace function admin_queue(p_status text default null, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return coalesce((select jsonb_agg(provider_json(p, 'private')
                                    order by (p.verification_status = 'pending') desc, p.submitted_at desc nulls last)
                     from providers p
                    where (p_status is null or p.verification_status::text = p_status)
                      and (p_kind is null or p.kind::text = p_kind)), '[]');
end $$;

create or replace function admin_provider_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p providers;
begin
  perform require_admin();
  select * into p from providers where id = p_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'provider', provider_json(p, 'private'),
    'documents', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'type', d.doc_type, 'name', d.doc_type,
                                                               'size', 0, 'storage_path', d.storage_path))
                             from provider_documents d where d.provider_id = p_id), '[]'),
    'owner', (select user_json(pr) from profiles pr where pr.user_id = p.owner_user_id),
    'fleet', coalesce((select jsonb_agg(rental_vehicle_json(v)) from rental_vehicles v where v.provider_id = p_id), '[]'),
    'audit', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'provider_id', a.entity_id, 'decision', a.action,
                                                          'reason', a.diff ->> 'reason', 'at', a.created_at) order by a.created_at desc)
                         from audit_log a where a.entity = 'provider' and a.entity_id = p_id), '[]'));
end $$;

create or replace function admin_decide(p_id uuid, p_decision text, p_reason text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare p providers; v_status verification_status;
begin
  perform require_admin();
  if p_decision not in ('approve', 'reject', 'request_changes', 'suspend') then raise exception 'invalid decision'; end if;
  if p_decision <> 'approve' and coalesce(trim(p_reason), '') = '' then raise exception 'a reason is required'; end if;
  v_status := case p_decision when 'approve' then 'approved' when 'reject' then 'rejected'
                              when 'request_changes' then 'changes_requested' else 'suspended' end;
  update providers set verification_status = v_status, review_note = case when p_decision = 'approve' then null else trim(p_reason) end,
         reviewed_at = now(), reviewed_by = auth.uid(),
         is_online = case when p_decision = 'approve' then is_online else false end, updated_at = now()
   where id = p_id returning * into p;
  if not found then return false; end if;
  if p_decision = 'request_changes' then update provider_applications set status = 'draft' where provider_id = p_id; end if;
  perform audit(p_decision, 'provider', p_id, jsonb_build_object('reason', p_reason));
  perform notify_user(p.owner_user_id, case p_decision when 'approve' then 'provider_approved' when 'reject' then 'provider_rejected'
                                                         when 'request_changes' then 'provider_changes_requested' else 'provider_suspended' end,
                      jsonb_build_object('reason', coalesce(p_reason, '')));
  return true;
end $$;

-- Admin creates a rider / service provider directly (e.g. a taxi owner registered at the office).
-- If the owner later signs up with the same phone and account type, the profile is linked to them.
create or replace function admin_create_provider(p_kind text, p_data jsonb, p_approve boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; p providers; v_phone text := nullif(regexp_replace(coalesce(p_data ->> 'phone', ''), '\s', '', 'g'), '');
begin
  perform require_admin();
  if p_kind not in ('rider', 'business') then raise exception 'invalid kind'; end if;
  if v_phone is null then raise exception 'phone required'; end if;
  v_id := upsert_provider_from_data(null, p_data, p_kind::provider_kind, null);
  update providers set managed_by_admin = true, claim_phone = v_phone, submitted_at = now(),
         verification_status = case when p_approve then 'approved'::verification_status else 'pending'::verification_status end,
         reviewed_at = case when p_approve then now() end, reviewed_by = case when p_approve then auth.uid() end,
         owner_user_id = (select user_id from profiles where phone = v_phone and role = 'provider' and provider_kind = p_kind::provider_kind
                            and not exists (select 1 from providers x where x.owner_user_id = profiles.user_id) limit 1)
   where id = v_id returning * into p;
  perform audit(case when p_approve then 'create_approved' else 'create' end, 'provider', v_id, jsonb_build_object('reason', 'created by admin'));
  return provider_json(p, 'private');
end $$;

create or replace function admin_update_provider(p_id uuid, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p providers;
begin
  perform require_admin();
  select * into p from providers where id = p_id;
  if not found then raise exception 'not found'; end if;
  perform upsert_provider_from_data(p_id, p_data - 'documents', p.kind, p.owner_user_id);
  perform audit('edit', 'provider', p_id, jsonb_build_object('reason', 'edited by admin'));
  select * into p from providers where id = p_id;
  return provider_json(p, 'private');
end $$;

create or replace function admin_users(p_role text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return coalesce((select jsonb_agg(user_json(pr) || jsonb_build_object(
                        'verification_status', p.verification_status, 'provider_name', p.display_name)
                      order by pr.created_at desc)
                     from profiles pr left join providers p on p.owner_user_id = pr.user_id
                    where pr.role <> 'admin' and (p_role is null or account_type(pr) = p_role)), '[]');
end $$;

create or replace function admin_block_user(p_user uuid, p_blocked boolean, p_reason text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_user = auth.uid() then raise exception 'you cannot block yourself'; end if;
  update profiles set is_blocked = p_blocked, updated_at = now() where user_id = p_user and role <> 'admin';
  if not found then return false; end if;
  if p_blocked then update providers set is_online = false where owner_user_id = p_user; end if;
  perform audit(case when p_blocked then 'block' else 'unblock' end, 'user', p_user, jsonb_build_object('reason', p_reason));
  return true;
end $$;

create or replace function admin_activity() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return jsonb_build_object(
    'bookings', coalesce((select jsonb_agg(booking_json(b) || jsonb_build_object('provider_name', (select display_name from providers where id = b.provider_id)) order by b.created_at desc)
                            from (select * from bookings order by created_at desc limit 300) b), '[]'),
    'rentals', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('provider_name', (select display_name from providers where id = r.provider_id)) order by r.created_at desc)
                           from (select * from rental_requests order by created_at desc limit 300) r), '[]'),
    'parcels', coalesce((select jsonb_agg(parcel_json(x, false) || jsonb_build_object('provider_name', (select display_name from providers where id = x.provider_id)) order by x.created_at desc)
                           from (select * from parcels order by created_at desc limit 300) x), '[]'));
end $$;

create or replace function admin_audit_log() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'actor', a.actor, 'actor_name', (select full_name from profiles where user_id = a.actor),
                                                       'action', a.action, 'entity', a.entity, 'entity_id', a.entity_id,
                                                       'reason', a.diff ->> 'reason', 'at', a.created_at) order by a.created_at desc)
                     from (select * from audit_log order by created_at desc limit 500) a), '[]');
end $$;

create or replace function admin_cancel_trip(p_id uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  update bookings set status = 'cancelled', updated_at = now() where id = p_id and status in ('requested', 'accepted', 'arriving', 'in_progress');
  if not found then return false; end if;
  perform audit('cancel', 'booking', p_id, jsonb_build_object('reason', p_reason));
  return true;
end $$;

create or replace function admin_set_pricing(p_vtype text, p_base int, p_per_km int, p_per_min int, p_min int) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform require_admin();
  if p_vtype not in ('moto', 'taxi', 'tricycle', 'truck') or least(p_base, p_per_km, p_per_min, p_min) < 0 then raise exception 'invalid pricing'; end if;
  delete from pricing_rules where vehicle_type::text = p_vtype;
  insert into pricing_rules (vehicle_type, base_fare, per_km, per_min, min_fare) values (p_vtype::vehicle_type, p_base, p_per_km, p_per_min, p_min);
  perform audit('pricing', 'pricing_rules', null, jsonb_build_object('vehicle_type', p_vtype, 'base', p_base, 'per_km', p_per_km, 'per_min', p_per_min, 'min', p_min));
  return true;
end $$;

-- ----------------------------------------------------------------------------
-- Function privileges: nothing is callable by default; grant explicitly.
-- ----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'is_admin()', 'is_provider()', 'is_registered()', 'require_user()', 'require_registered()', 'require_admin()',
    'my_provider_id()', 'provider_is_approved(uuid)', 'notify_user(uuid,text,jsonb)', 'audit(text,text,uuid,jsonb)',
    'user_json(profiles)', 'provider_json(providers,text)', 'booking_json(bookings)', 'rental_vehicle_json(rental_vehicles)',
    'parcel_json(parcels,boolean)', 'upsert_provider_from_data(uuid,jsonb,provider_kind,uuid)', 'expire_stale_trips()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
  -- helpers RLS policies need
  execute 'grant execute on function is_admin(), my_provider_id(), provider_is_approved(uuid), is_registered() to anon, authenticated';
end $$;

-- callable by guests (no account) as well
grant execute on function estimate_trip(float8, float8, float8, float8, text, int), list_public_providers(boolean, text, text),
  get_public_provider(uuid), list_rentals() to anon, authenticated;

-- callable by any signed-in session (anonymous guests included)
revoke execute on function create_trip(text, jsonb, jsonb, text, text, text, text, int), get_trip(uuid), my_trips(), set_trip_status(uuid, text),
  create_rental_request(uuid, text, text, date, date, boolean), get_rental_request(uuid), my_rental_requests(), set_rental_status(uuid, text),
  create_parcel(jsonb), get_parcel(uuid), my_parcels(), create_guest_transfer(), my_notifications(), mark_notifications_read(),
  my_profile(), my_account() from public, anon;
grant execute on function create_trip(text, jsonb, jsonb, text, text, text, text, int), get_trip(uuid), my_trips(), set_trip_status(uuid, text),
  create_rental_request(uuid, text, text, date, date, boolean), get_rental_request(uuid), my_rental_requests(), set_rental_status(uuid, text),
  create_parcel(jsonb), get_parcel(uuid), my_parcels(), create_guest_transfer(), my_notifications(), mark_notifications_read(),
  my_profile(), my_account() to authenticated;

-- registered accounts (functions re-check is_registered() / roles themselves)
revoke execute on function register_profile(text, text, text, text, text), update_profile(text, text, text, text), redeem_guest_transfer(text),
  save_application(int, jsonb), submit_application(), provider_offers(uuid), set_online(boolean, float8, float8),
  update_provider_settings(boolean, text, text), provider_trips(), incoming_requests(), accept_trip(uuid), decline_trip(uuid),
  rate_trip(uuid, int, text), provider_rental_requests(), respond_rental(uuid, boolean), add_fleet_vehicle(jsonb),
  update_fleet_vehicle(uuid, jsonb), remove_fleet_vehicle(uuid), provider_parcels(), accept_parcel(uuid), pickup_parcel(uuid),
  deliver_parcel(uuid, text) from public, anon;
grant execute on function register_profile(text, text, text, text, text), update_profile(text, text, text, text), redeem_guest_transfer(text),
  save_application(int, jsonb), submit_application(), provider_offers(uuid), set_online(boolean, float8, float8),
  update_provider_settings(boolean, text, text), provider_trips(), incoming_requests(), accept_trip(uuid), decline_trip(uuid),
  rate_trip(uuid, int, text), provider_rental_requests(), respond_rental(uuid, boolean), add_fleet_vehicle(jsonb),
  update_fleet_vehicle(uuid, jsonb), remove_fleet_vehicle(uuid), provider_parcels(), accept_parcel(uuid), pickup_parcel(uuid),
  deliver_parcel(uuid, text) to authenticated;

-- admin (each also calls require_admin(): role = admin AND aal2)
revoke execute on function am_i_admin(), admin_overview(), admin_queue(text, text), admin_provider_detail(uuid), admin_decide(uuid, text, text),
  admin_create_provider(text, jsonb, boolean), admin_update_provider(uuid, jsonb), admin_users(text), admin_block_user(uuid, boolean, text),
  admin_activity(), admin_audit_log(), admin_cancel_trip(uuid, text), admin_set_pricing(text, int, int, int, int) from public, anon;
grant execute on function am_i_admin(), admin_overview(), admin_queue(text, text), admin_provider_detail(uuid), admin_decide(uuid, text, text),
  admin_create_provider(text, jsonb, boolean), admin_update_provider(uuid, jsonb), admin_users(text), admin_block_user(uuid, boolean, text),
  admin_activity(), admin_audit_log(), admin_cancel_trip(uuid, text), admin_set_pricing(text, int, int, int, int) to authenticated;

-- The old RPCs let callers act without ownership checks; retire them.
do $$ begin
  revoke execute on function accept_booking(uuid) from public, anon, authenticated;
  revoke execute on function set_booking_status(uuid, booking_status) from public, anon, authenticated;
exception when undefined_function then null; end $$;

-- ----------------------------------------------------------------------------
-- Storage: private bucket for verification documents (owner folder = user id)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-docs', 'provider-docs', false, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-media', 'public-media', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "provider docs owner write" on storage.objects;
create policy "provider docs owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'provider-docs' and (storage.foldername(name))[1] = auth.uid()::text and is_registered());
drop policy if exists "provider docs owner read" on storage.objects;
create policy "provider docs owner read" on storage.objects for select to authenticated
  using (bucket_id = 'provider-docs' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
drop policy if exists "provider docs owner delete" on storage.objects;
create policy "provider docs owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'provider-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "public media owner write" on storage.objects;
create policy "public media owner write" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-media' and (storage.foldername(name))[1] = auth.uid()::text and is_registered());

-- ----------------------------------------------------------------------------
-- Housekeeping: expire unanswered trip requests every minute (if pg_cron exists)
-- ----------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gobert-expire-trips', '* * * * *', 'select public.expire_stale_trips()');
  end if;
exception when others then null; end $$;

comment on function is_admin() is 'True only for an admin profile in an aal2 (password + TOTP) session.';
comment on column providers.claim_phone is 'Set when an admin creates the provider; the owner claims it by registering with this phone.';
