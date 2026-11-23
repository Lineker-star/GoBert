-- seed
insert into cities (name, region, is_active) values
  ('Bertoua','East',true),
  ('Ngaoundéré','Adamawa',false),
  ('Garoua','North',false),
  ('Maroua','Far North',false)
on conflict do nothing;

insert into pricing_rules (city_id, vehicle_type, base_fare, per_km, per_min, min_fare)
select id, 'moto', 300, 100, 25, 500 from cities where name='Bertoua'
union all select id,'taxi',500,150,30,800 from cities where name='Bertoua'
union all select id,'tricycle',400,120,25,600 from cities where name='Bertoua'
union all select id,'truck',1000,300,50,2000 from cities where name='Bertoua'
on conflict do nothing;

-- 25 approved providers (15 moto, 6 taxi, 2 tricycle, 2 truck)
-- + 5 pending providers for the admin queue
-- + 2 rental vehicles (car_rental) linked to 2 truck providers
-- Idempotent: skips if providers already seeded.
do $$
declare
  bertoua uuid;
  names text[] := array[
    'Mbarga Jean','Nkoulou Marie','Tchoumi Paul','Etoa Bernard','Mballa Rose',
    'Nkeng Samuel','Tanyi Grace','Fouda Pierre','Manga Alice','Ngo Bell',
    'Tchinda Joseph','Ekema Sylvie','Nkolo David','Mbah Eric','Toche Clarisse',
    'Ngambe Serge','Etoundi Jeanne','Mballa II','Nkoulou Jean','Tchoumi Alain',
    'Etoa Marie','Mballa Paul','Nkeng Rose','Tanyi Bernard','Fouda Grace',
    'Ngambe Paul','Etoundi Marie','Mballa Jean','Nkoulou Alain','Tchoumi Rose'
  ];
  types text[] := array[
    'moto','moto','moto','moto','moto','moto','moto','moto','moto','moto',
    'moto','moto','moto','moto','moto','taxi','taxi','taxi','taxi','taxi','taxi',
    'tricycle','tricycle','truck','truck',
    'moto','taxi','tricycle','truck','moto'
  ];
  quartiers text[] := array[
    'Centre','Mokolo','Kadey','Ngangue','Bertoua A','Bertoua B','Wasa','Gare',
    'Marché','Hôpital','Carrefour','SNH','Pétrolex','Cité-verte','Nkolndongo'
  ];
  i int;
  prof uuid;
  prov uuid;
  veh uuid;
  svc uuid;
  vtype vehicle_type;
  st verification_status;
  vlat float;
  vlng float;
  rent_veh uuid;
  rent_svc uuid;
begin
  if exists (select 1 from providers) then
    return;
  end if;
  select id into bertoua from cities where name='Bertoua';
  for i in 1..30 loop
    st := case when i <= 25 then 'approved'::verification_status else 'pending'::verification_status end;
    vtype := types[i]::vehicle_type;
    vlat := 4.5774 + ((i % 7) - 3) * 0.006;
    vlng := 13.6846 + ((i % 5) - 2) * 0.008;

    insert into profiles (full_name, phone, language)
    values (names[i], '+237' || lpad((699000000 + i)::text, 9, '0'), 'fr')
    returning id into prof;

    insert into providers (
      profile_id, display_name, city_id, verification_status, rating_avg, rating_count,
      accepts_direct_calls, whatsapp, is_online, last_location, last_seen_at
    ) values (
      prof, names[i], bertoua, st,
      case when st='approved' then round((4.2 + (i % 7) * 0.1)::numeric, 1) else 0 end,
      case when st='approved' then 5 + i * 3 else 0 end,
      (i % 2 = 0),
      '+237' || lpad((699000000 + i)::text, 9, '0'),
      st='approved' and (i % 3 <> 0),
      st_makepoint(vlng, vlat)::geography,
      case when st='approved' then now() - (i || ' minutes')::interval else null end
    ) returning id into prov;

    insert into vehicles (provider_id, vehicle_type, brand, model, year, plate, color, seats, payload_kg, status)
    values (
      prov, vtype,
      case vtype when 'moto' then 'Sanota' when 'taxi' then 'Toyota' when 'tricycle' then 'Piaggio' when 'truck' then 'Renault' else 'Toyota' end,
      case vtype when 'moto' then 'RX 135' when 'taxi' then 'Corolla' when 'tricycle' then 'Ape' when 'truck' then 'Master' else 'Corolla' end,
      2018 + (i % 6),
      'EST ' || lpad((100 + i * 7)::text, 3, '0') || ' ' || chr(65 + (i % 26)) || chr(65 + ((i + 3) % 26)),
      case vtype when 'moto' then 'Rouge' when 'taxi' then 'Blanc' when 'tricycle' then 'Bleu' when 'truck' then 'Gris' else 'Blanc' end,
      case when vtype='truck' then 3 else 2 end,
      case when vtype='truck' then 3000 else null end,
      st
    ) returning id into veh;

    insert into services (
      provider_id, vehicle_id, service_type, title_fr, title_en, description_fr, description_en,
      base_price_xaf, price_per_km_xaf, price_per_hour_xaf, price_per_day_xaf, zones, status
    ) values (
      prov, veh,
      case vtype when 'moto' then 'moto'::service_type when 'taxi' then 'ride'::service_type when 'tricycle' then 'ride'::service_type when 'truck' then 'cargo'::service_type else 'rent'::service_type end,
      'Course ' || names[i], 'Ride ' || names[i],
      'Service de ' || vtype || ' à Bertoua', vtype || ' service in Bertoua',
      case vtype when 'moto' then 300 when 'taxi' then 500 when 'tricycle' then 400 when 'truck' then 1000 else 5000 end,
      case vtype when 'moto' then 100 when 'taxi' then 150 when 'tricycle' then 120 when 'truck' then 300 else 200 end,
      case when vtype='taxi' then 2000 else null end,
      case when vtype='car_rental' then 15000 else null end,
      array['Bertoua', quartiers[(i % 15) + 1], 'Centre'],
      st
    ) returning id into svc;

    if st='approved' then
      insert into availability (service_id, day_of_week, start_time, end_time, is_24h)
      select svc, d,
        case when vtype='truck' then '00:00'::time else '06:00'::time end,
        case when vtype='truck' then '23:59'::time else '22:00'::time end,
        vtype='truck'
      from generate_series(1,7) d;
    end if;

    -- 2 rental vehicles (car_rental) on the 2 truck providers (i = 24, 25)
    if i in (24, 25) then
      insert into vehicles (provider_id, vehicle_type, brand, model, year, plate, color, seats, status)
      values (prov, 'car_rental', 'Toyota', 'Hilux', 2020, 'EST ' || lpad((900 + i)::text, 3, '0') || ' RT', 'Blanc', 5, 'approved')
      returning id into rent_veh;

      insert into services (
        provider_id, vehicle_id, service_type, title_fr, title_en, description_fr, description_en,
        base_price_xaf, price_per_km_xaf, price_per_hour_xaf, price_per_day_xaf, zones, status
      ) values (
        prov, rent_veh, 'rent',
        'Location ' || names[i], 'Rent ' || names[i],
        'Véhicule de location à Bertoua', 'Rental vehicle in Bertoua',
        5000, 200, 3000, 15000,
        array['Bertoua','Centre'],
        'approved'
      ) returning id into rent_svc;

      insert into availability (service_id, day_of_week, start_time, end_time, is_24h)
      select rent_svc, d, '08:00'::time, '20:00'::time, false from generate_series(1,7) d;
    end if;
  end loop;
end $$;