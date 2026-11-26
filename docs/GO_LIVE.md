# GoBert — going live on Supabase

## Status (26 Nov 2026)

- [x] Migrations 202611250001–0004 applied to project `dpziqhptuvjqbikrvcju` (one transaction); 30 seed providers backfilled.
- [x] Security checks run; mutable search_path fixed (0003). Remaining by design: public read RPCs callable by guests, deny-all tables written only via functions, extensions (postgis, pg_trgm, vector) in `public`.
- [x] Auth pushed with `supabase config push`: anonymous sign-ins, phone sign-up, 8-char letters+digits passwords, 60 s SMS throttle, /auth redirect URLs. Email confirmation and TOTP were already on.
- [x] Both apps on the live database (`NEXT_PUBLIC_USE_MOCKS=false`); admin served only under the secret `ADMIN_BASE_PATH` in apps/admin/.env.local.
- [x] `supabase/tests/e2e_rollback.sql`: 41/41 checks on the live DB (always rolls back). `apps/web/scripts/shoot-live.mjs`: 14/14 live UI checks.
- [ ] SMS provider credentials (Twilio/Vonage) — Dashboard → Authentication → Phone.
- [ ] Custom SMTP for email (built-in Supabase email is rate-limited and meant for testing).
- [ ] First admin account (step 3 below) and production domain in redirect URLs.

The app runs on the in-memory demo backend while `NEXT_PUBLIC_USE_MOCKS=true`.
These steps switch it to the real Supabase project (`dpziqhptuvjqbikrvcju`).

## 1. Apply the database migration

Apply `supabase/migrations/202611250001_account_types_verification.sql`
(either via the Supabase connector once it is linked to the account that owns
the project, or `supabase db push` with the CLI).

It adds the three account types, admin-gated verification, guest booking,
rentals, parcels, notifications, the admin API, private document storage, and
fixes two privilege-escalation holes in the original policies
(self-promotion to `admin`, and providers approving themselves).

## 2. Supabase dashboard → Authentication

| Setting | Value | Why |
|---|---|---|
| Anonymous sign-ins | **On** | Guests book rides without an account |
| Email provider | On, "Confirm email" on | Email + password and magic link |
| Phone provider | **On**, SMS provider credentials (Twilio / Vonage / MessageBird) | SMS code and phone + password |
| Multi-factor (TOTP) | On (default) | Mandatory for admins |
| Site URL / Redirect URLs | `https://<your-domain>/fr/auth`, `/en/auth` | Magic links and password reset |
| CAPTCHA (recommended) | hCaptcha or Turnstile | Blocks bot sign-ups and SMS pumping |
| Rate limits | Keep defaults or lower SMS per hour | Cost and abuse protection |

## 3. Create the first administrator

1. Create a normal account with **email + password** in the web app.
2. In the SQL editor (runs as `postgres`, which the user-facing API can never do):
   ```sql
   update profiles set role = 'admin'
   where user_id = (select id from auth.users where email = 'you@example.cm');
   ```
3. Open the admin console at its secret URL, sign in, scan the QR code with an
   authenticator app. Admin powers only work after this 2FA step.

## 4. Environment variables

**apps/web**: `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, optionally `NEXT_PUBLIC_OSRM_URL` (own routing
server — the public demo server is for light use only).

**apps/admin**: same Supabase URL/key, `NEXT_PUBLIC_USE_MOCKS=false`,
`ADMIN_BASE_PATH=/<random-slug-of-12+-chars>` (required for production builds —
this is the secret URL), optionally `ADMIN_ALLOWED_IPS` (office IPs / CIDR).
Host the admin on its own subdomain.

No service-role key is used by either app.

## 5. Optional

- Enable the `pg_cron` extension: unanswered trip requests then expire every minute
  (they are also expired lazily whenever a trip is read).
- Real Mobile Money collection (MTN MoMo / Orange Money) still requires an
  aggregator account; today the method is recorded and paid to the rider directly.
