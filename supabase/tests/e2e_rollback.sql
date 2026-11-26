-- End-to-end test of the GoBert v2 database API against a real project.
-- Impersonates users by setting the JWT claims PostgREST would set, runs every flow
-- through the real RPCs as role `authenticated`, and ALWAYS ends with an exception so
-- the whole transaction rolls back (nothing is left behind).
--   supabase db query --remote=<ref> --yes -f supabase/tests/e2e_rollback.sql
do $$
declare
  c uuid := gen_random_uuid();   -- registered customer
  g uuid := gen_random_uuid();   -- anonymous guest
  r uuid := gen_random_uuid();   -- rider
  r2 uuid := gen_random_uuid();  -- second rider (race)
  b uuid := gen_random_uuid();   -- business
  a uuid := gen_random_uuid();   -- admin
  out text := '';
  n int := 0;
  fails int := 0;
  rp uuid; r2p uuid; bp uuid; trip uuid; trip2 uuid; veh uuid; rent uuid; parcel uuid; code text; otp text;
  j jsonb; ok boolean; cnt int; msg text;
  docs_r jsonb := '[{"type":"id_card","name":"a","size":1,"data_url":"","storage_path":"x/a.jpg"},{"type":"license","name":"b","size":1,"data_url":"","storage_path":"x/b.jpg"},{"type":"registration","name":"c","size":1,"data_url":"","storage_path":"x/c.jpg"}]';
  docs_b jsonb := '[{"type":"business_registration","name":"a","size":1,"data_url":"","storage_path":"x/a.jpg"},{"type":"manager_id","name":"b","size":1,"data_url":"","storage_path":"x/b.jpg"}]';
begin
  -- ---------------------------------------------------------------- fixtures (as postgres)
  insert into auth.users (instance_id, id, aud, role, email, phone, is_anonymous, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', c, 'authenticated', 'authenticated', 'e2e-c@gobert.test', null, false, now(), now()),
         ('00000000-0000-0000-0000-000000000000', g, 'authenticated', 'authenticated', null, null, true, now(), now()),
         ('00000000-0000-0000-0000-000000000000', r, 'authenticated', 'authenticated', null, '237690990001', false, now(), now()),
         ('00000000-0000-0000-0000-000000000000', r2, 'authenticated', 'authenticated', null, '237690990002', false, now(), now()),
         ('00000000-0000-0000-0000-000000000000', b, 'authenticated', 'authenticated', 'e2e-b@gobert.test', null, false, now(), now()),
         ('00000000-0000-0000-0000-000000000000', a, 'authenticated', 'authenticated', 'e2e-a@gobert.test', null, false, now(), now());
  insert into profiles (user_id, role, full_name) values (a, 'admin', 'E2E Admin');

  execute 'set local role authenticated';

  -- helper: switch identity
  -- (claims are read by auth.uid() / auth.jwt())
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);

  -- ================================================================ rider onboarding
  j := register_profile('rider', 'E2E Rider', null, 'Bertoua', 'fr');
  n := n + 1; if j ->> 'role' <> 'rider' then fails := fails + 1; out := out || ' FAIL:rider-profile'; end if;
  perform save_application(1, jsonb_build_object('kind', 'rider', 'full_name', 'E2E Rider', 'phone', '+237690990001', 'vehicle_type', 'moto'));
  begin
    perform submit_application();
    fails := fails + 1; out := out || ' FAIL:incomplete-accepted';
  exception when others then
    get stacked diagnostics msg = pg_exception_detail;
    n := n + 1; if msg not like '%plate%' then fails := fails + 1; out := out || ' FAIL:missing-list(' || msg || ')'; end if;
  end;
  perform save_application(5, jsonb_build_object('brand', 'Sanya', 'model', 'SY125', 'plate', 'ES 990 E2', 'documents', docs_r,
     'services', '[{"type":"moto","title_fr":"moto","title_en":"moto","base_price_xaf":300,"zones":["Bertoua"]}]'::jsonb));
  j := submit_application(); rp := (j ->> 'id')::uuid;
  n := n + 1; if j ->> 'verification_status' <> 'pending' then fails := fails + 1; out := out || ' FAIL:pending'; end if;
  n := n + 1; if set_online(true, 4.5776, 13.6848) then fails := fails + 1; out := out || ' FAIL:pending-online'; end if;

  -- self-approval must be impossible (no write policy on providers)
  update providers set verification_status = 'approved' where id = rp;
  get diagnostics cnt = row_count;
  n := n + 1; if cnt <> 0 then fails := fails + 1; out := out || ' FAIL:self-approve'; end if;
  -- self-promotion to admin must be impossible
  update profiles set role = 'admin' where user_id = r;
  get diagnostics cnt = row_count;
  n := n + 1; if cnt <> 0 then fails := fails + 1; out := out || ' FAIL:self-admin'; end if;

  -- invisible to the public while pending
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  n := n + 1; if exists (select 1 from jsonb_array_elements(list_public_providers()) e where (e ->> 'id')::uuid = rp) then fails := fails + 1; out := out || ' FAIL:pending-visible'; end if;

  -- ================================================================ admin needs 2FA
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  begin
    perform admin_decide(rp, 'approve', null);
    fails := fails + 1; out := out || ' FAIL:admin-without-2fa';
  exception when others then n := n + 1;
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal2')::text, true);
  begin
    perform admin_decide(rp, 'reject', '');
    fails := fails + 1; out := out || ' FAIL:reject-without-reason';
  exception when others then n := n + 1;
  end;
  n := n + 1; if not admin_decide(rp, 'approve', null) then fails := fails + 1; out := out || ' FAIL:approve'; end if;
  n := n + 1; if (admin_overview() -> 'overview' ->> 'approved')::int < 1 then fails := fails + 1; out := out || ' FAIL:overview'; end if;

  -- second rider, created and approved directly by the admin (claimed later by phone)
  j := admin_create_provider('rider', jsonb_build_object('full_name', 'E2E Rider Two', 'phone', '+237690990002', 'vehicle_type', 'moto', 'plate', 'ES 991 E2',
       'services', '[{"type":"moto","title_fr":"moto","title_en":"moto","base_price_xaf":300,"zones":["Bertoua"]}]'::jsonb), true);
  r2p := (j ->> 'id')::uuid;
  n := n + 1; if j ->> 'verification_status' <> 'approved' then fails := fails + 1; out := out || ' FAIL:admin-create'; end if;

  -- ================================================================ riders online
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  n := n + 1; if not set_online(true, 4.5776, 13.6848) then fails := fails + 1; out := out || ' FAIL:approved-online'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', r2, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  j := register_profile('rider', 'E2E Rider Two', null, 'Bertoua', 'fr');   -- claims the admin-created provider
  n := n + 1; if (j ->> 'provider_id')::uuid is distinct from r2p then fails := fails + 1; out := out || ' FAIL:claim-by-phone'; end if;
  perform set_online(true, 4.5777, 13.6849);

  -- ================================================================ guest books without an account
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  j := estimate_trip(4.5776, 13.6848, 4.5895, 13.6963, 'moto');
  n := n + 1; if (j ->> 'fare_estimate_xaf')::int <= 0 then fails := fails + 1; out := out || ' FAIL:estimate'; end if;
  j := create_trip('moto', '{"lat":4.5776,"lng":13.6848,"label":"Centre"}', '{"lat":4.5895,"lng":13.6963,"label":"Mokolo"}', 'orange_money', null, '+237699123456', 'e2e', 2300);
  trip := (j ->> 'id')::uuid;
  n := n + 1; if j ->> 'status' <> 'requested' or j ->> 'payment_method' <> 'orange_money' then fails := fails + 1; out := out || ' FAIL:create-trip'; end if;
  -- guests never get phone numbers and cannot see offers
  n := n + 1; if exists (select 1 from jsonb_array_elements(list_public_providers()) e where e ->> 'phone' is not null) then fails := fails + 1; out := out || ' FAIL:guest-sees-phone'; end if;
  begin
    perform provider_offers(rp);
    fails := fails + 1; out := out || ' FAIL:guest-offers';
  exception when others then n := n + 1;
  end;

  -- ================================================================ dispatch: single winner
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  j := incoming_requests();
  n := n + 1; if not exists (select 1 from jsonb_array_elements(j) e where (e ->> 'id')::uuid = trip and e ->> 'passenger_phone' like '%•••%') then fails := fails + 1; out := out || ' FAIL:incoming-masked'; end if;
  n := n + 1; if not accept_trip(trip) then fails := fails + 1; out := out || ' FAIL:accept'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', r2, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  n := n + 1; if accept_trip(trip) then fails := fails + 1; out := out || ' FAIL:double-accept'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  j := get_trip(trip);
  n := n + 1; if j ->> 'provider_phone' is null or (j -> 'provider' ->> 'id')::uuid <> rp then fails := fails + 1; out := out || ' FAIL:reveal-after-accept'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  n := n + 1; if set_trip_status(trip, 'completed') then fails := fails + 1; out := out || ' FAIL:skip-states'; end if;
  perform set_trip_status(trip, 'arriving'); perform set_trip_status(trip, 'in_progress');
  n := n + 1; if not set_trip_status(trip, 'completed') then fails := fails + 1; out := out || ' FAIL:complete'; end if;

  -- guests must sign in to rate
  perform set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated', 'is_anonymous', true)::text, true);
  begin
    perform rate_trip(trip, 5, 'x');
    fails := fails + 1; out := out || ' FAIL:guest-rated';
  exception when others then n := n + 1;
  end;
  -- guest → account: trips move over with a one-time code
  code := create_guest_transfer();
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  perform register_profile('customer', 'E2E Customer', 'e2e-c@gobert.test', 'Bertoua', 'fr');
  n := n + 1; if redeem_guest_transfer(code) < 1 then fails := fails + 1; out := out || ' FAIL:guest-transfer'; end if;
  n := n + 1; if not rate_trip(trip, 5, 'Très bien') then fails := fails + 1; out := out || ' FAIL:rate'; end if;
  n := n + 1; if exists (select 1 from jsonb_array_elements(list_public_providers()) e where (e ->> 'id')::uuid = rp and (e ->> 'rating_count')::int <> 1) then fails := fails + 1; out := out || ' FAIL:rating-count'; end if;
  n := n + 1; if (provider_offers(rp) -> 'provider' ->> 'phone') is null then fails := fails + 1; out := out || ' FAIL:registered-sees-phone'; end if;

  -- ================================================================ business: rentals + express
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  perform register_profile('business', 'E2E Manager', 'e2e-b@gobert.test', 'Bertoua', 'fr');
  perform save_application(5, jsonb_build_object('kind', 'business', 'full_name', 'E2E Manager', 'phone', '+237677990001',
     'business_name', 'E2E Location', 'business_type', 'car_rental', 'registration_number', 'RC/BTA/E2E', 'documents', docs_b,
     'services', '[{"type":"rent","title_fr":"rent","title_en":"rent","base_price_xaf":15000,"zones":["Bertoua"]},{"type":"express","title_fr":"express","title_en":"express","base_price_xaf":500,"zones":["Bertoua"]}]'::jsonb,
     'fleet', '[{"type":"car","brand":"Toyota","model":"Prado","plate":"ES 100 E2","price_per_day_xaf":40000,"price_per_hour_xaf":6000,"deposit_xaf":80000,"with_driver":true,"seats":7}]'::jsonb));
  j := submit_application(); bp := (j ->> 'id')::uuid;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  n := n + 1; if exists (select 1 from jsonb_array_elements(list_rentals()) e where (e ->> 'provider_id')::uuid = bp) then fails := fails + 1; out := out || ' FAIL:fleet-visible-pending'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal2')::text, true);
  perform admin_decide(bp, 'approve', null);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  select (e ->> 'id')::uuid into veh from jsonb_array_elements(list_rentals()) e where (e ->> 'provider_id')::uuid = bp;
  n := n + 1; if veh is null then fails := fails + 1; out := out || ' FAIL:fleet-after-approve'; end if;
  j := create_rental_request(veh, 'E2E Customer', '+237699123456', current_date + 1, current_date + 2, true);
  rent := (j ->> 'id')::uuid;
  n := n + 1; if (j ->> 'total_xaf')::int <> 80000 then fails := fails + 1; out := out || ' FAIL:rental-total'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', r, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  n := n + 1; if respond_rental(rent, true) then fails := fails + 1; out := out || ' FAIL:other-provider-responds'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  n := n + 1; if not respond_rental(rent, true) then fails := fails + 1; out := out || ' FAIL:respond'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  j := create_parcel('{"sender_name":"E2E","sender_phone":"+237699123456","receiver_name":"Bob","receiver_phone":"+237699000777","pickup":{"lat":4.5776,"lng":13.6848,"label":"Centre"},"dropoff":{"lat":4.5895,"lng":13.6963,"label":"Mokolo"},"size":"small"}');
  parcel := (j ->> 'id')::uuid; otp := j ->> 'otp';
  n := n + 1; if otp is null then fails := fails + 1; out := out || ' FAIL:sender-otp'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  n := n + 1; if exists (select 1 from jsonb_array_elements(provider_parcels()) e where (e ->> 'id')::uuid = parcel and e ->> 'otp' is not null) then fails := fails + 1; out := out || ' FAIL:courier-sees-otp'; end if;
  n := n + 1; if not accept_parcel(parcel) then fails := fails + 1; out := out || ' FAIL:accept-parcel'; end if;
  perform pickup_parcel(parcel);
  n := n + 1; if deliver_parcel(parcel, '0000') then fails := fails + 1; out := out || ' FAIL:wrong-otp'; end if;
  n := n + 1; if not deliver_parcel(parcel, otp) then fails := fails + 1; out := out || ' FAIL:deliver'; end if;
  begin
    execute 'select otp from parcels limit 1';
    fails := fails + 1; out := out || ' FAIL:otp-column-readable';
  exception when insufficient_privilege then n := n + 1;
  end;

  -- ================================================================ blocked accounts
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal2')::text, true);
  perform admin_block_user(c, true, 'e2e');
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  begin
    perform create_trip('moto', '{"lat":4.5776,"lng":13.6848,"label":"A"}', '{"lat":4.58,"lng":13.69,"label":"B"}');
    fails := fails + 1; out := out || ' FAIL:blocked-can-book';
  exception when others then n := n + 1;
  end;

  -- ================================================================ report (and roll everything back)
  raise exception 'E2E RESULT: % checks, % failed.%', n, fails, case when out = '' then ' ALL PASSED' else out end;
end $$;
