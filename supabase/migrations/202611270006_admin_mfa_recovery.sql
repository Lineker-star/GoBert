-- Self-service recovery for an admin who lost their authenticator app.
--
-- The admin proves control of their email inbox by signing in with a one-time email
-- code (Supabase records it in the JWT "amr" claim as method "otp"). Within 15 minutes
-- of that, and only for an account whose profile role is admin, this deletes the
-- account's 2FA factors so the login page can enrol a new authenticator (fresh QR code).
-- Admin powers still require that new authenticator (aal2) afterwards.
create or replace function admin_reset_own_mfa() returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  amr jsonb := coalesce(auth.jwt() -> 'amr', '[]'::jsonb);
  fresh_email_proof boolean;
  n int;
begin
  if uid is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where user_id = uid and role = 'admin') then
    raise exception 'not an administrator' using errcode = '42501';
  end if;
  select exists (
    select 1 from jsonb_array_elements(amr) e
    where e ->> 'method' in ('otp', 'magiclink')
      and (e ->> 'timestamp')::bigint > extract(epoch from now())::bigint - 900
  ) into fresh_email_proof;
  if not fresh_email_proof then
    raise exception 'email code sign-in required' using errcode = '42501';
  end if;

  delete from auth.mfa_factors where user_id = uid;
  get diagnostics n = row_count;
  perform audit('admin_mfa_reset', 'user', uid, jsonb_build_object('factors_removed', n));
  return n;
end $$;

revoke execute on function admin_reset_own_mfa() from public, anon;
grant execute on function admin_reset_own_mfa() to authenticated;
