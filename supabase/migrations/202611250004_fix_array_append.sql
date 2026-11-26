-- Fix: text[] || 'literal' was parsed as an array literal ("Array value must start with...").
-- Use array_append. (Caught by supabase/tests/e2e_rollback.sql against the live project.)

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
