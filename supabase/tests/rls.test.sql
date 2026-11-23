-- RLS tests: anonymous users must not read provider documents or other users' bookings.
-- Run against a Supabase local/prod DB:
--   psql "$DATABASE_URL" -f supabase/tests/rls.test.sql
-- or via the Supabase CLI test runner.
-- Exits non-zero (raises) on the first failed assertion.

grant usage on schema public to anon;
grant select on public.providers, public.provider_documents, public.bookings,
  public.vehicles, public.services, public.availability to anon;

-- 1. anon cannot read provider_documents
set role anon;
do $$
declare cnt int;
begin
  select count(*) into cnt from provider_documents;
  if cnt > 0 then
    raise exception 'FAIL: anon read % provider_documents rows (expected 0)', cnt;
  end if;
  raise notice 'PASS: anon cannot read provider_documents';
end $$;

-- 2. anon cannot read bookings (no anon_token match)
do $$
declare cnt int;
begin
  select count(*) into cnt from bookings;
  if cnt > 0 then
    raise exception 'FAIL: anon read % bookings rows (expected 0)', cnt;
  end if;
  raise notice 'PASS: anon cannot read bookings';
end $$;
reset role;

-- 3. anon CAN read approved providers (public read policy)
set role anon;
do $$
declare cnt int;
begin
  select count(*) into cnt from providers where verification_status='approved';
  if cnt = 0 then
    raise exception 'FAIL: anon cannot read approved providers (expected >0)';
  end if;
  raise notice 'PASS: anon can read % approved providers', cnt;
end $$;

-- 4. anon cannot read pending providers (only approved are public)
do $$
declare cnt int;
begin
  select count(*) into cnt from providers where verification_status='pending';
  if cnt > 0 then
    raise exception 'FAIL: anon read % pending providers (expected 0)', cnt;
  end if;
  raise notice 'PASS: anon cannot read pending providers';
end $$;
reset role;

-- 5. anon cannot read wallet_ledger (provider financial data)
grant select on public.wallet_ledger to anon;
set role anon;
do $$
declare cnt int;
begin
  select count(*) into cnt from wallet_ledger;
  if cnt > 0 then
    raise exception 'FAIL: anon read % wallet_ledger rows (expected 0)', cnt;
  end if;
  raise notice 'PASS: anon cannot read wallet_ledger';
end $$;
reset role;