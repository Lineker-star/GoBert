-- RPC functions
create or replace function nearby_providers(lat double precision, lng double precision, radius_m int, vehicle_type_filter vehicle_type default null)
returns table(id uuid, display_name text, distance_m double precision) language sql stable as $$
  select p.id, p.display_name, st_distance(p.last_location, st_makepoint(lng,lat)::geography) as distance_m
  from providers p
  where p.verification_status='approved' and p.is_online=true
    and st_dwithin(p.last_location, st_makepoint(lng,lat)::geography, radius_m)
    and (vehicle_type_filter is null or exists (select 1 from vehicles v where v.provider_id=p.id and v.vehicle_type=vehicle_type_filter))
  order by distance_m;
$$;

create or replace function estimate_fare(pickup geography, dropoff geography, vtype vehicle_type, city_id uuid)
returns int language plpgsql stable as $$
declare d int; rule pricing_rules%rowtype; fare int;
begin
  d := st_distance(pickup, dropoff)::int;
  select * into rule from pricing_rules where pricing_rules.city_id=estimate_fare.city_id and pricing_rules.vehicle_type=vtype limit 1;
  if not found then return 0; end if;
  fare := greatest(rule.min_fare, rule.base_fare + (rule.per_km * (d/1000)) + (rule.per_min * (d/500)));
  return round(fare / 25.0) * 25;
end;
$$;

create or replace function create_booking(
  p_passenger uuid, p_anon text, p_provider uuid, p_service uuid, p_vtype vehicle_type,
  p_pickup geography, p_pickup_label text, p_dropoff geography, p_dropoff_label text,
  p_fare int, p_payment payment_method, p_notes text, p_phone_masked text
) returns uuid language plpgsql as $$
declare bid uuid;
begin
  insert into bookings (passenger_id, anon_token, provider_id, service_id, vehicle_type, pickup, pickup_label, dropoff, dropoff_label, fare_estimate_xaf, payment_method, notes, contact_phone_masked)
  values (p_passenger, p_anon, p_provider, p_service, p_vtype, p_pickup, p_pickup_label, p_dropoff, p_dropoff_label, p_fare, p_payment, p_notes, p_phone_masked)
  returning id into bid;
  insert into booking_events (booking_id, status, actor) values (bid, 'requested', 'passenger');
  return bid;
end;
$$;

create or replace function accept_booking(booking_id uuid) returns boolean language plpgsql as $$
declare updated int;
begin
  update bookings set status='accepted', updated_at=now()
  where id=accept_booking.booking_id and status in ('requested','offered')
  returning 1 into updated;
  if updated is null then return false; end if;
  insert into booking_events (booking_id, status, actor) values (booking_id, 'accepted', 'provider');
  return true;
end;
$$;

create or replace function set_booking_status(booking_id uuid, new_status booking_status) returns boolean language plpgsql as $$
declare cur booking_status;
begin
  select status into cur from bookings where id=booking_id for update;
  if cur is null then return false; end if;
  -- legal transitions
  if not (
    (cur='accepted' and new_status in ('arriving','cancelled','no_show')) or
    (cur='arriving' and new_status in ('in_progress','cancelled','no_show')) or
    (cur='in_progress' and new_status in ('completed','cancelled')) or
    (cur='requested' and new_status in ('offered','cancelled','expired'))
  ) then return false; end if;
  update bookings set status=new_status, updated_at=now() where id=booking_id;
  insert into booking_events (booking_id, status, actor) values (booking_id, new_status, 'system');
  return true;
end;
$$;
