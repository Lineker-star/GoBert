-- Security advisor follow-up: pin search_path on every remaining public function
-- (lint: function_search_path_mutable) and retire the old booking RPC.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
     where n.nspname = 'public' and d.objid is null
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop;
end $$;

do $$ begin
  revoke execute on function create_booking from public, anon, authenticated;
exception when undefined_function or ambiguous_function then null; end $$;
