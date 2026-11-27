# Deploying GoBert on Vercel

## Current deployment (27 Nov 2026)

| Project | Production URL | Notes |
|---|---|---|
| `gobert` | <https://gobert-lyart.vercel.app> | Public app. Vercel Authentication only on preview deployments. |
| `gobert-ops` | `https://gobert-ops.vercel.app<ADMIN_BASE_PATH>/login` | Admin console; every other URL answers 404. The team URL (`gobert-ops-megajtechnologies-3208s-projects.vercel.app`) additionally requires a Vercel login. |

Both projects are in the team `megajtechnologies-3208s-projects`, use Node 22 and deploy commit
`main`. The secret admin path is stored as a *sensitive* environment variable in `gobert-ops`.

GoBert is two Next.js apps in one repository. Each becomes **its own Vercel project**:

| Vercel project | Root Directory | What it is |
|---|---|---|
| `gobert` (suggested name) | `apps/web` | The public app: customers, riders, service providers (PWA) |
| `gobert-ops` (suggested name) | `apps/admin` | The admin console, only reachable under its secret path |

Both use the same Supabase project (`dpziqhptuvjqbikrvcju`). Neither uses a service-role key.

## 1. Import the repository (do this twice)

1. Open <https://vercel.com/new?teamSlug=megajtechnologies-3208s-projects> and import `Lineker-star/GoBert`.
2. **Root Directory**: `apps/web` for the first project, `apps/admin` for the second.
   Framework is detected as Next.js. Leave Build/Install commands empty: each app's
   `vercel.json` already installs with the pinned pnpm (`pnpm@12.3.4`, frozen lockfile).
3. Add the environment variables below **before** the first deploy, then click Deploy.

## 2. Environment variables

### `apps/web`

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dpziqhptuvjqbikrvcju.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key (`sb_publishable_…`) |
| `NEXT_PUBLIC_USE_MOCKS` | `false` |
| `NEXT_PUBLIC_OSRM_URL` | optional: your own routing server (the public demo server is rate-limited) |

### `apps/admin`

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | same as web |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same as web |
| `NEXT_PUBLIC_USE_MOCKS` | `false` |
| `ADMIN_BASE_PATH` | the secret path, e.g. `/ops-…` (≥ 12 letters/digits). The build fails without it. Copy it from `apps/admin/.env.local` or generate a new one. |
| `ADMIN_ALLOWED_IPS` | optional: comma-separated IPs / IPv4 CIDR allowed to open the console |

`NEXT_PUBLIC_*` values are baked in at build time: after changing one, **redeploy**.

The admin console is then at `https://<admin-domain><ADMIN_BASE_PATH>/login`. Every other
URL on that domain answers 404, by design.

## 3. Supabase → Authentication → URL Configuration

Once Vercel has given the web project its domain (e.g. `https://gobert.vercel.app`, or your own
domain), set in the Supabase dashboard:

- **Site URL**: `https://<web-domain>`
- **Redirect URLs** (add):
  - `https://<web-domain>/**`
  - `https://*-megajtechnologies-3208s-projects.vercel.app/**` (preview deployments of your team only)

Without this, email confirmation, magic-link and password-reset links send people back to
`localhost`. The same values live in `supabase/config.toml` (`site_url`,
`additional_redirect_urls`) and can be pushed with `supabase config push`.

## 4. Database

Apply any migration in `supabase/migrations/` that is not yet on the project (in name order).
`202611260005_admin_stats.sql` adds the admin trend charts; until it is applied the overview
says "Statistiques indisponibles" and everything else keeps working.

## 5. Before going public

- [ ] SMS provider (Twilio / Vonage / MessageBird) in Supabase → Authentication → Phone,
      otherwise SMS-code and phone + password sign-ups cannot finish.
- [ ] Custom SMTP in Supabase → Authentication → Emails (the built-in sender is limited to a
      few emails per hour).
- [ ] CAPTCHA (hCaptcha or Turnstile) in Supabase → Authentication → Attack Protection.
- [ ] Own domain for the admin console (Vercel → Project → Domains), e.g. `ops.example.cm`.

## Checking a deployment

```bash
# demo-mode end-to-end test (local, no network needed)
cd apps/web && NEXT_PUBLIC_USE_MOCKS=true pnpm dev -p 3200   # and the admin in demo mode on 3201
SHOT_BASE=http://localhost:3200 ADMIN_BASE=http://localhost:3201 node scripts/e2e-mock.mjs

# live smoke test against any deployment (no passwords involved)
SHOT_BASE=https://<web-domain> ADMIN_BASE=https://<admin-domain> ADMIN_PATH=/ops-… node scripts/shoot-live.mjs
```
