-- tables
create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  center geography(point,4326),
  is_active boolean default false,
  pricing_multiplier numeric default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role user_role default 'passenger',
  full_name text,
  phone text,
  language text default 'fr',
  avatar_url text,
  is_anonymous boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists providers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  display_name text,
  bio text,
  city_id uuid references cities(id),
  verification_status verification_status default 'draft',
  rating_avg numeric default 0,
  rating_count int default 0,
  accepts_direct_calls boolean default false,
  whatsapp text,
  is_online boolean default false,
  last_location geography(point,4326),
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  doc_type text,
  storage_path text,
  status verification_status default 'pending',
  reviewed_by uuid,
  review_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  vehicle_type vehicle_type,
  brand text,
  model text,
  year int,
  plate text,
  color text,
  seats int,
  payload_kg int,
  photos text[] default '{}',
  status verification_status default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references providers(id) on delete cascade,
  vehicle_id uuid references vehicles(id),
  service_type service_type,
  title_fr text,
  title_en text,
  description_fr text,
  description_en text,
  base_price_xaf int,
  price_per_km_xaf int,
  price_per_hour_xaf int,
  price_per_day_xaf int,
  zones text[] default '{}',
  status verification_status default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id) on delete cascade,
  day_of_week int,
  start_time time,
  end_time time,
  is_24h boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists pricing_rules (
  id uuid primary key default gen_random_uuid(),
  city_id uuid references cities(id),
  vehicle_type vehicle_type,
  base_fare int,
  per_km int,
  per_min int,
  min_fare int,
  night_multiplier numeric default 1,
  surge_cap numeric default 2,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid references profiles(id),
  anon_token text,
  provider_id uuid references providers(id),
  service_id uuid references services(id),
  vehicle_type vehicle_type,
  pickup geography(point,4326),
  pickup_label text,
  dropoff geography(point,4326),
  dropoff_label text,
  status booking_status default 'requested',
  fare_estimate_xaf int,
  fare_final_xaf int,
  distance_m int,
  payment_method payment_method,
  scheduled_at timestamptz,
  notes text,
  contact_phone_masked text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  status booking_status,
  actor text,
  payload jsonb,
  created_at timestamptz default now()
);

create table if not exists rentals (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id),
  renter_id uuid references profiles(id),
  start_at timestamptz,
  end_at timestamptz,
  with_driver boolean default false,
  deposit_xaf int,
  total_xaf int,
  status booking_status default 'requested',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  rental_id uuid references rentals(id),
  method payment_method,
  amount_xaf int,
  status payment_status default 'pending',
  provider_ref text,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  from_id uuid,
  to_id uuid,
  stars int check (stars between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create table if not exists sos_alerts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id),
  user_id uuid,
  location geography(point,4326),
  status text default 'open',
  handled_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  anon_token text,
  language text default 'fr',
  created_at timestamptz default now()
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete cascade,
  role text,
  content text,
  tokens int,
  created_at timestamptz default now()
);

create table if not exists ai_settings (
  id uuid primary key default gen_random_uuid(),
  provider text,
  model text,
  system_prompt text,
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  channel text,
  title text,
  body text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  action text,
  entity text,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz default now()
);

-- indexes
create index if not exists providers_location_idx on providers using gist (last_location);
create index if not exists bookings_pickup_idx on bookings using gist (pickup);
create index if not exists providers_online_idx on providers (is_online) where verification_status='approved';

-- updated_at trigger
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

do $$ declare t text; begin
  for t in select unnest(array['cities','profiles','providers','provider_documents','vehicles','services','availability','pricing_rules','bookings','rentals','payments','sos_alerts','ai_settings']) loop
    execute format('drop trigger if exists trg_updated_at on %I; create trigger trg_updated_at before update on %I for each row execute function set_updated_at();', t, t);
  end loop;
end $$;
