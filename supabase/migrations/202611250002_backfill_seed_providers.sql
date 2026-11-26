-- Backfill the denormalised provider columns (added in 202611250001) from the original
-- normalised tables, for providers created before v2 (seed data). Idempotent: only
-- touches rows whose services list is still empty.

with v as (
  select distinct on (provider_id) provider_id, vehicle_type::text as vt, brand, model, plate, color, year, seats, payload_kg
  from vehicles order by provider_id, created_at
),
s as (
  select provider_id,
         array_agg(distinct case when service_type::text = 'travel' then 'ride' else service_type::text end) as services,
         jsonb_agg(jsonb_build_object(
           'type', case when service_type::text = 'travel' then 'ride' else service_type::text end,
           'title_fr', coalesce(title_fr, service_type::text), 'title_en', coalesce(title_en, service_type::text),
           'base_price_xaf', coalesce(base_price_xaf, price_per_day_xaf, 0),
           'price_per_km_xaf', price_per_km_xaf, 'price_per_day_xaf', price_per_day_xaf,
           'zones', to_jsonb(coalesce(zones, '{}'::text[])))) as details
  from services group by provider_id
),
a as (
  select sv.provider_id,
         bool_or(av.is_24h) as is_24h,
         array_agg(distinct case when av.day_of_week = 7 then 0 else av.day_of_week end) as days, -- app uses 0 = Sunday
         to_char(min(av.start_time), 'HH24:MI') as start_t,
         to_char(max(av.end_time), 'HH24:MI') as end_t
  from availability av join services sv on sv.id = av.service_id group by sv.provider_id
)
update providers p set
  kind = case when v.vt in ('car_rental', 'van', 'bus') then 'business'::provider_kind else 'rider'::provider_kind end,
  phone = coalesce(p.phone, pr.phone),
  lat = coalesce(p.lat, st_y(p.last_location::geometry)),
  lng = coalesce(p.lng, st_x(p.last_location::geometry)),
  services = coalesce(s.services, '{}'),
  service = coalesce(s.services[1], case v.vt when 'moto' then 'moto' when 'taxi' then 'ride' when 'truck' then 'cargo' else 'express' end),
  service_details = coalesce(s.details, '[]'),
  vehicle = case when v.provider_id is null or v.vt in ('car_rental', 'van', 'bus') then p.vehicle else jsonb_build_object(
    'type', v.vt, 'brand', coalesce(v.brand, ''), 'model', coalesce(v.model, ''), 'plate', coalesce(v.plate, ''),
    'color', coalesce(v.color, ''), 'year', v.year, 'seats', v.seats, 'payload_kg', v.payload_kg) end,
  schedule = case when a.provider_id is null then p.schedule
                  else jsonb_build_object('days', to_jsonb(a.days), 'start', coalesce(a.start_t, '06:00'),
                                          'end', coalesce(a.end_t, '22:00'), 'is_24h', coalesce(a.is_24h, false)) end,
  submitted_at = coalesce(p.submitted_at, p.created_at),
  reviewed_at = case when p.verification_status = 'approved' then coalesce(p.reviewed_at, p.updated_at) else p.reviewed_at end,
  managed_by_admin = true
from providers p0
left join v on v.provider_id = p0.id
left join s on s.provider_id = p0.id
left join a on a.provider_id = p0.id
left join profiles pr on pr.id = p0.profile_id
where p.id = p0.id and cardinality(p.services) = 0;
