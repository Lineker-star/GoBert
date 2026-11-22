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
