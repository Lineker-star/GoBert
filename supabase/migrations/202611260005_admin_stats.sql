-- Daily platform statistics for the admin overview (trend charts and CSV export).
-- Days are counted in Cameroon time (Africa/Douala, UTC+1).
create or replace function admin_stats(p_days int default 14) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  n int := least(greatest(coalesce(p_days, 14), 1), 90);
  first_day date := (now() at time zone 'Africa/Douala')::date - (n - 1);
begin
  perform require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'day', d.day,
             'trips', coalesce(b.trips, 0),
             'completed', coalesce(b.completed, 0),
             'cancelled', coalesce(b.cancelled, 0),
             'revenue_xaf', coalesce(b.revenue, 0),
             'rentals', coalesce(r.n, 0),
             'parcels', coalesce(pa.n, 0),
             'signups', coalesce(s.n, 0),
             'applications', coalesce(ap.n, 0)) order by d.day)
    from (select first_day + i as day from generate_series(0, n - 1) as i) d
    left join (
      select (created_at at time zone 'Africa/Douala')::date as day,
             count(*) as trips,
             count(*) filter (where status = 'completed') as completed,
             count(*) filter (where status in ('cancelled', 'expired', 'no_show')) as cancelled,
             sum(coalesce(fare_final_xaf, fare_estimate_xaf, 0)) filter (where status = 'completed') as revenue
        from bookings where created_at >= first_day - 1 group by 1) b on b.day = d.day
    left join (select (created_at at time zone 'Africa/Douala')::date as day, count(*) as n
                 from rental_requests where created_at >= first_day - 1 group by 1) r on r.day = d.day
    left join (select (created_at at time zone 'Africa/Douala')::date as day, count(*) as n
                 from parcels where created_at >= first_day - 1 group by 1) pa on pa.day = d.day
    left join (select (created_at at time zone 'Africa/Douala')::date as day, count(*) as n
                 from profiles where created_at >= first_day - 1 group by 1) s on s.day = d.day
    left join (select (submitted_at at time zone 'Africa/Douala')::date as day, count(*) as n
                 from providers where submitted_at >= first_day - 1 group by 1) ap on ap.day = d.day
  ), '[]'::jsonb);
end $$;

revoke execute on function admin_stats(int) from public, anon;
grant execute on function admin_stats(int) to authenticated;
