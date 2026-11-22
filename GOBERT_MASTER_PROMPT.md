# GOBERT — MASTER BUILD PROMPT
### *Move. Connect. Go.* — Born in Bertoua. Built for Cameroon. Ready for Africa.

> **How to use this file**
> 1. Create an empty GitHub repo (e.g. `lineker-star/gobert`) and clone it.
> 2. Copy **Section 0 (Project Rules)** into `.cursor/rules/gobert.mdc` (set `alwaysApply: true`).
> 3. Open Cursor in Agent mode and paste **one Phase prompt at a time** (Sections 4 to 17). Do not skip phases. Do not paste the whole file at once.
> 4. After each phase, run the **Definition of Done** checklist, commit, push, and let CI pass before moving on.

---

## 0. PROJECT RULES (paste into `.cursor/rules/gobert.mdc`)

```md
---
description: GoBert project rules
alwaysApply: true
---

# Identity
You are a senior full-stack and mobile engineer building GoBert, a mobility
platform for Bertoua and the East, Adamawa, North and Far North regions of
Cameroon. Tagline: "Move. Connect. Go."

# Non-negotiables
1. LOW-INTERNET FIRST: every screen must work on 2G/3G, cheap Android phones,
   and intermittent connectivity. Offline cache, request queue, retries with
   backoff, small payloads, no heavy images, no large JS bundles.
2. BILINGUAL: French (default) and English. No hard-coded strings. All text
   goes through i18n files (fr.json / en.json, or ARB for Flutter).
3. SECURITY: Supabase Row Level Security on EVERY table. Never expose the
   service_role key to clients. Secrets only in env vars / Supabase secrets /
   Vercel env / GitHub secrets.
4. SAFETY & PRIVACY: phone numbers masked in-app unless the user chooses
   "Call directly". Anonymous booking must not store personal identity.
5. MOBILE-FIRST, ACCESSIBLE: large touch targets, high contrast, simple wording,
   icons with labels, usable by people with low digital literacy.
6. SMALL STEPS: build one phase at a time, with tests, and explain what you did.
   Ask before adding any dependency not listed in the stack.
7. CURRENCY: XAF (FCFA), integers only, no decimals. Timezone: Africa/Douala.

# Stack (do not deviate without asking)
- Mobile (Passenger + Driver): Flutter 3.x (Dart), Riverpod, go_router,
  drift (SQLite) for offline, maplibre_gl, flutter_localizations
- Web (landing, passenger web, provider web, admin): Next.js 15 (App Router),
  TypeScript, Tailwind, next-intl, PWA (service worker, offline fallback)
- Backend: Supabase (Postgres + PostGIS, Auth, Realtime, Storage, Edge Functions)
- Maps: MapLibre + OpenStreetMap tiles (no Google Maps cost), OSRM or
  Valhalla for routing, Nominatim/Photon for geocoding (self-host later)
- AI: Claude API called ONLY from Supabase Edge Functions (never from client)
- Payments: Mobile Money (MTN MoMo + Orange Money) through a local aggregator
  (e.g. CinetPay / Notch Pay / Campay), plus cash
- Notifications: FCM push + SMS fallback (local SMS gateway)
- Hosting: Vercel (web), Supabase (backend), GitHub Actions (CI/CD)
- Monorepo: pnpm workspaces for web; /mobile for Flutter

# Brand tokens
Green #087C55 | Deep Forest #123D32 | Orange #F28C28 (CTAs only) |
Ivory #F7F5EF | Charcoal #242B29 | Soft Grey #E8ECE9
Fonts: Plus Jakarta Sans (headings), Inter (body). Rounded, friendly, modern.

# Code standards
- TypeScript strict. Dart analysis with `very_good_analysis` or `flutter_lints`.
- Conventional Commits. Small PRs. Every migration is a file in
  /supabase/migrations. Never edit the DB by hand in the dashboard.
- Every feature: tests + i18n keys in both languages + offline behaviour defined.
```

---

## 1. PRODUCT SUMMARY

**GoBert** is a real-time, AI-powered mobility marketplace for Cameroon, launching in **Bertoua**, then expanding to Ngaoundéré (Adamawa), Garoua (North) and Maroua (Far North).

Bertoua has few taxis but many motorcycle taxis. GoBert therefore unifies **motorcycles, taxis (personal cars), tricycles, trucks and vehicle rental** in one platform. Independent vehicle owners register, list their services, hours and days of work. Admins verify them before they become visible. Users **book anonymously** or **call the provider directly**. An **AI assistant** knows the whole platform and guides users in French and English.

### Service ecosystem (launch order)
| Phase | Service | Description |
|---|---|---|
| 1 | **GoBert Moto** | Motorcycle taxis |
| 1 | **GoBert Ride** | Taxis and private cars |
| 1 | **GoBert Express** | Parcels and local deliveries (tricycles, motos) |
| 2 | **GoBert Cargo** | Goods transport (trucks, tricycles) |
| 2 | **GoBert Rent** | Vehicle and truck rental |
| 3 | **GoBert Travel** | Intercity transport |
| 3 | **GoBert Food** | Food delivery |
| 3 | **GoBert Business / Partner** | Merchant and driver ecosystems |

### Apps and surfaces
1. **GoBert** (passenger): Flutter Android/iOS + PWA web
2. **GoBert Driver / Partner**: Flutter Android/iOS + provider web portal
3. **GoBert Admin**: Next.js dashboard (verification, pricing, support, analytics, AI settings)
4. **Landing site**: gobert.cm (or gobert.app), bilingual, SEO

### Two booking modes (core of the product)
- **Dispatch mode (Uber-style)**: passenger requests, nearby online providers get the request, first to accept wins, live tracking.
- **Directory mode (Bertoua reality)**: browse verified providers with their schedules, then **Book** or **Call directly** (`tel:` / WhatsApp link). Works even when real-time is down.

---

## 2. ARCHITECTURE

```
                    ┌──────────────────────────────────┐
                    │          GitHub (monorepo)       │
                    │  main ──► Vercel (web) + Supabase│
                    └───────────────┬──────────────────┘
                                    │ GitHub Actions CI/CD
 ┌───────────────┐  ┌───────────────┴────────────┐  ┌────────────────┐
 │ Flutter apps  │  │      Next.js on Vercel     │  │  Admin panel   │
 │ Passenger +   │  │ landing, PWA, provider web │  │  (Next.js)     │
 │ Driver        │  └───────────────┬────────────┘  └───────┬────────┘
 └───────┬───────┘                  │                       │
         └──────────────┬───────────┴───────────────────────┘
                        ▼
        ┌───────────────────────────────────────────┐
        │                 SUPABASE                  │
        │ Auth (phone OTP + anonymous) · Postgres + │
        │ PostGIS · Realtime · Storage · Edge Fns   │
        └───────┬───────────────┬──────────────┬────┘
                ▼               ▼              ▼
          Claude API     Mobile Money      FCM / SMS
        (AI assistant)   aggregator        gateway
```

### Repo layout
```
gobert/
├─ .cursor/rules/gobert.mdc
├─ .github/workflows/        # ci-web.yml, ci-mobile.yml, deploy-supabase.yml
├─ apps/
│  ├─ web/                   # Next.js: landing + passenger PWA + provider portal
│  └─ admin/                 # Next.js admin dashboard
├─ mobile/                   # Flutter: one codebase, two flavors (passenger, driver)
├─ packages/
│  ├─ ui/                    # shared web components + brand tokens
│  ├─ i18n/                  # fr.json, en.json shared copy
│  └─ types/                 # generated Supabase types
├─ supabase/
│  ├─ migrations/
│  ├─ functions/             # edge functions
│  ├─ seed.sql
│  └─ config.toml
├─ docs/                     # ADRs, runbooks, API notes
└─ README.md
```

---

## 3. DATA MODEL (target schema)

Enable extensions: `postgis`, `pgcrypto`, `pg_trgm`, `pg_cron`.

**Enums**
- `user_role`: passenger, provider, admin, support
- `vehicle_type`: moto, taxi, tricycle, truck, car_rental, van, bus
- `service_type`: ride, moto, express, cargo, rent, travel
- `verification_status`: draft, pending, approved, rejected, suspended
- `booking_status`: requested, offered, accepted, arriving, in_progress, completed, cancelled, expired, no_show
- `payment_method`: cash, mtn_momo, orange_money
- `payment_status`: pending, paid, failed, refunded

**Tables (all with `id uuid pk`, `created_at`, `updated_at`)**
| Table | Key fields |
|---|---|
| `profiles` | user_id (fk auth.users), role, full_name, phone, language (fr/en), avatar_url, is_anonymous |
| `providers` | profile_id, display_name, bio, city_id, verification_status, rating_avg, rating_count, accepts_direct_calls, whatsapp, is_online, last_location geography(Point), last_seen_at |
| `provider_documents` | provider_id, doc_type (CNI, permis, carte grise, assurance, visite technique, photo), storage_path, status, reviewed_by, review_note |
| `vehicles` | provider_id, vehicle_type, brand, model, year, plate, color, seats, payload_kg, photos[], status |
| `services` | provider_id, vehicle_id, service_type, title_fr, title_en, description_fr, description_en, base_price_xaf, price_per_km_xaf, price_per_hour_xaf, price_per_day_xaf, zones[], status (verification_status) |
| `availability` | service_id, day_of_week (0-6), start_time, end_time, is_24h |
| `cities` | name, region, center geography, is_active, pricing_multiplier |
| `pricing_rules` | city_id, vehicle_type, base_fare, per_km, per_min, min_fare, night_multiplier, surge_cap |
| `bookings` | passenger_id (nullable for anonymous), anon_token, provider_id, service_id, vehicle_type, pickup geography, pickup_label, dropoff geography, dropoff_label, status, fare_estimate_xaf, fare_final_xaf, distance_m, payment_method, scheduled_at, notes, contact_phone_masked |
| `booking_events` | booking_id, status, actor, payload jsonb, created_at (audit trail) |
| `rentals` | service_id, renter_id, start_at, end_at, with_driver bool, deposit_xaf, total_xaf, status |
| `payments` | booking_id/rental_id, method, amount_xaf, status, provider_ref, raw jsonb |
| `ratings` | booking_id, from_id, to_id, stars 1-5, comment |
| `sos_alerts` | booking_id, user_id, location, status, handled_by |
| `ai_conversations` / `ai_messages` | user_id or anon_token, language, role, content, tokens |
| `ai_settings` | provider, model, system_prompt, enabled (admin-managed; API key lives in Supabase secrets, never in a table readable by clients) |
| `notifications` | user_id, channel, title, body, sent_at |
| `audit_log` | actor, action, entity, entity_id, diff |

**Indexes:** GIST on every geography column; btree on `(status, vehicle_type)`; partial index on `providers(is_online) WHERE verification_status='approved'`.

**RLS principles**
- Passengers read/write only their own bookings; anonymous users via `anon_token` claim.
- Providers see only requests offered to them and their own data.
- Public (anon) can read only `approved` providers/services/vehicles through a **view** that hides phone numbers, documents and sensitive columns.
- Only `admin` role (checked via a `is_admin()` security-definer function) can change `verification_status`.
- Documents bucket is private; signed URLs for admins only.

---

## 4. PHASE 1 — FOUNDATION (repo, tooling, CI skeleton)

**Paste into Cursor:**

```
PHASE 1: Foundation. Read .cursor/rules/gobert.mdc first.

1. Initialise a pnpm monorepo with apps/web, apps/admin, packages/ui,
   packages/i18n, packages/types as described in the rules.
2. Scaffold Next.js 15 (App Router, TypeScript strict, Tailwind) for apps/web
   and apps/admin. Configure next-intl with fr (default) and en, locale
   routing /fr and /en, and a language switcher component.
3. Add the GoBert design tokens (colours, Plus Jakarta Sans + Inter via
   next/font) to a shared Tailwind preset in packages/ui. Build base
   components: Button, Input, Select, Card, Badge, Modal, Toast, Skeleton,
   BottomNav, LanguageSwitcher, OfflineBanner.
4. Scaffold the Flutter project in /mobile with two flavors
   (passenger, driver), Riverpod, go_router, flutter_localizations with
   ARB files (app_fr.arb, app_en.arb), and a theme using the same tokens.
5. Add ESLint, Prettier, Husky + lint-staged, commitlint (Conventional Commits).
6. Create .env.example files listing every variable (no secrets).
7. Write README.md with local setup steps and a docs/ARCHITECTURE.md.
8. Create .github/workflows/ci-web.yml (install, lint, typecheck, test, build)
   and ci-mobile.yml (flutter analyze, flutter test, build apk debug).

Output: a short summary, the commands I should run, and any decision you made.
```

**Definition of Done:** `pnpm dev` runs web and admin; `flutter run --flavor passenger` runs; CI is green.

---

## 5. PHASE 2 — SUPABASE BACKEND (schema, RLS, seed)

**Manual steps (you):**
1. Create a Supabase project (region closest to Cameroon, e.g. `eu-west` / Frankfurt or London).
2. Install the Supabase CLI: `npm i -g supabase` then `supabase login`, `supabase init`, `supabase link --project-ref <ref>`.
3. Enable in Dashboard → Auth: Phone (OTP), Anonymous sign-ins, Email.
4. Create Storage buckets: `provider-docs` (private), `vehicle-photos` (public read), `avatars` (public read).

**Paste into Cursor:**

```
PHASE 2: Supabase backend. Follow Section 3 (Data Model) of GOBERT_MASTER_PROMPT.md.

1. Write migrations in /supabase/migrations (timestamped, one concern each):
   extensions, enums, tables, indexes, triggers (updated_at), helper
   functions (is_admin, is_provider, current_anon_token), views, RLS policies.
2. Create public-safe views: v_public_providers, v_public_services,
   v_public_vehicles exposing ONLY approved rows and non-sensitive columns,
   including computed "is_available_now" based on availability + Africa/Douala time.
3. Create SQL functions (RPC):
   - nearby_providers(lat, lng, radius_m, vehicle_type) using PostGIS ST_DWithin
   - estimate_fare(pickup, dropoff, vehicle_type, city_id)
   - create_booking(...) which writes booking + booking_events
   - accept_booking(booking_id) with row locking so only ONE provider wins
   - set_booking_status(booking_id, status) with a legal state machine
4. Trigger: on provider approval, notify the provider; on rating insert,
   recompute providers.rating_avg.
5. seed.sql: cities (Bertoua active; Ngaoundéré, Garoua, Maroua inactive),
   pricing_rules for moto/taxi/tricycle/truck in Bertoua (XAF),
   demo providers and services, an admin user.
6. Generate TypeScript types into packages/types (supabase gen types).
7. Write pgTAP or SQL tests for RLS: prove an anonymous user cannot read
   provider documents or other users' bookings.

Explain every RLS policy in plain language in docs/RLS.md.
```

**Definition of Done:** `supabase db reset` runs clean; RLS tests pass; types generated.

---

## 6. PHASE 3 — AUTH, PROFILES & PROVIDER ONBOARDING

```
PHASE 3: Auth and provider onboarding.

AUTH (web + Flutter):
- Phone number + OTP login (Cameroon +237 default, validate formats for
  MTN/Orange/Camtel/Nexttel).
- "Continue without account" = Supabase anonymous sign-in. Booking works;
  convert to full account later without losing history (linkIdentity).
- Language picker on first launch, saved to profiles.language.
- Roles: passenger (default), provider, admin.

PROVIDER ONBOARDING WIZARD (web portal + Flutter driver app):
Step 1 Identity: name, phone, WhatsApp, city, photo.
Step 2 Vehicle(s): type (moto/taxi/tricycle/truck/rental), brand, model, year,
        plate, colour, seats or payload, up to 5 photos (compressed client-side
        to <200 KB).
Step 3 Documents: CNI, driving licence, carte grise, insurance, technical
        inspection (photo upload, private bucket, resumable upload).
Step 4 Services: choose service types; titles/descriptions in FR and EN
        (offer auto-translate via Edge Function); pricing (base, per km,
        per hour, per day); coverage zones/quartiers.
Step 5 Schedule: days of the week + hours, "24/7" toggle, holiday off-days.
Step 6 Review and submit: status becomes "pending".
- Save draft after every step (works offline, syncs later).
- Show verification status banner: pending / approved / rejected with reason.

ADMIN VERIFICATION (apps/admin):
- Queue of pending providers, side-by-side document viewer (signed URLs),
  checklist, Approve / Reject (with reason) / Request changes / Suspend.
- Every action writes to audit_log and notifies the provider (push + SMS).
- Admin can edit prices, zones and service text before approving.
```

**Definition of Done:** a test provider can onboard end-to-end, an admin approves, and the provider appears in the public directory view.

---

## 7. PHASE 4 — PASSENGER EXPERIENCE (directory + booking)

```
PHASE 4: Passenger app (Flutter + web PWA).

HOME: service tiles (Moto, Ride, Express, Cargo, Rent) with icons + FR/EN labels.
Big "Where to?" input. Quick shortcuts (Home, Work, Market, Hospital, Carrefour).

MAP & LOCATION:
- MapLibre with OSM tiles, vector tiles if available, raster fallback.
- Cache tiles for Bertoua and surroundings for offline use.
- Pickup = GPS or pin drag or typed landmark. Cameroonian addresses are
  landmark-based ("derrière le marché", "carrefour Mokolo"), so support
  free-text landmarks and "saved places" with community-added names.

BOOKING FLOW (Dispatch mode):
1. Choose vehicle type -> see fare estimate in XAF and ETA.
2. Choose payment (cash / MoMo / Orange Money).
3. Confirm -> request goes to nearby online providers, in waves (nearest first,
   expand radius after 20 seconds, expire after 2 minutes).
4. First acceptance wins -> show provider name, photo, vehicle, plate, rating.
5. Live tracking (Realtime) with ETA; SOS button; share trip link by SMS/WhatsApp.
6. Complete -> pay -> rate.

DIRECTORY MODE:
- List/map of verified providers filtered by vehicle type, availability now,
  rating, price, zone.
- Provider profile: photos, services, working hours, price, reviews.
- Buttons: "Book" and "Call directly" (tel: link) and "WhatsApp".
- Log call intents (anonymised) for analytics.

ANONYMOUS BOOKING:
- No signup. Store only an anon_token. Phone is optional; if given, mask it
  and share it with the provider only after acceptance.

OTHER:
- Trip history, favourites, scheduled rides, promo codes, referral code.
- Parcel flow (Express): sender, receiver, parcel size/photo, proof of delivery
  via OTP code.
- Rental flow (Rent): choose vehicle -> dates/hours -> with/without driver ->
  deposit rules -> request -> provider confirms.
```

---

## 8. PHASE 5 — DRIVER / PROVIDER APP

```
PHASE 5: Driver app (Flutter driver flavor + provider web portal).

- Big ONLINE/OFFLINE toggle. While online, send location every 5-10 s (adaptive:
  slower when stationary or on weak signal), batch points when offline.
- Incoming request screen: pickup, distance, fare, accept/decline timer,
  audible alert + vibration, works in background (FCM high priority).
- Trip screen: navigation hand-off (open maps), "I've arrived", "Start trip",
  "Complete trip", cash collected confirmation.
- Earnings dashboard: today/week/month, commission deducted, payout history.
- Manage services, prices, schedule and vehicles after approval (edits to
  sensitive fields go back to "pending").
- Rating and performance: acceptance rate, cancellation rate.
- Incentives, support chat, SOS, document expiry reminders.
- Rental manager: calendar of rental requests, accept/decline, mark vehicle
  handed over/returned.
```

---

## 9. PHASE 6 — REAL-TIME ENGINE

```
PHASE 6: Real-time dispatch.

1. Use Supabase Realtime (Postgres changes + Broadcast + Presence):
   - Presence channel per city for online providers.
   - Broadcast channel per booking for live location and status.
2. Edge Function `dispatch-booking`:
   - Find nearest approved + online providers via nearby_providers().
   - Offer in waves; record offers in a booking_offers table.
   - Use accept_booking() with row lock to guarantee a single winner.
   - Handle expiry via pg_cron (every 30 s) and mark expired.
3. Location throttling and compression: send only lat/lng/heading/timestamp.
4. LOW-INTERNET RESILIENCE:
   - Local action queue (drift/SQLite on mobile, IndexedDB on web) with
     idempotency keys so retries never create duplicate bookings.
   - Exponential backoff with jitter, request timeouts of 8-10 s.
   - If Realtime drops, fall back to polling every 5-10 s.
   - SMS fallback: critical events (driver assigned, driver arriving,
     OTP) sent by SMS when push fails.
   - Optional USSD/SMS booking keyword for feature phones (Phase 8+).
5. Tests: simulate two providers accepting at once; simulate network loss
   mid-trip and recovery.
```

---

## 10. PHASE 7 — PAYMENTS & PRICING

```
PHASE 7: Payments and pricing.

PRICING:
- Fare = max(min_fare, base + per_km*distance + per_min*duration) x
  night_multiplier x optional demand multiplier (capped by surge_cap).
- Round to the nearest 25 XAF. Admin edits pricing_rules per city/vehicle.
- Rental pricing: per hour / day / week + deposit + optional driver fee.
- Cargo pricing: distance + weight + loading help.

PAYMENTS:
- Cash default. Add Mobile Money (MTN MoMo, Orange Money) through ONE
  aggregator abstraction (interface PaymentProvider) so the aggregator
  can be swapped.
- Edge Functions: `payments-initiate`, `payments-webhook` (verify signature,
  idempotent), `payments-status`.
- Platform commission (configurable %, default 10%) tracked per trip;
  provider wallet ledger (double-entry table), payout requests, admin approval.
- Receipts (FR/EN) as lightweight PDF or shareable text.
- Never store card/MoMo PINs. Keep raw webhook payloads in payments.raw.
```

---

## 11. PHASE 8 — GOBERT AI ASSISTANT

```
PHASE 8: AI assistant "GoBert Assistant" (FR/EN, voice optional).

ARCHITECTURE:
- Edge Function `ai-assistant` calls the Claude API. The API key lives in
  Supabase secrets (ANTHROPIC_API_KEY). The client never sees it.
- Admin panel > AI Settings: enable/disable, choose model, edit system prompt,
  set daily token limits, view usage. (Key stays in secrets; admin only
  controls non-secret settings.)
- Streaming responses, short answers, WhatsApp-style tone, auto-detect FR/EN.

KNOWLEDGE ("knows everything about the platform"):
- Build a platform knowledge base: services, how to book, how to become a
  provider, verification requirements, pricing rules, safety, payment methods,
  cities, FAQs. Store as markdown in /supabase/knowledge, embed with pgvector
  (table ai_knowledge with embedding), retrieve top-k per question (RAG).
- Tools the assistant can call (function calling), always scoped to the
  signed-in or anonymous user:
  * search_providers(vehicle_type, near, available_now)
  * estimate_fare(pickup, dropoff, vehicle_type)
  * start_booking_draft(...)  -> returns a draft the user must confirm
  * get_booking_status(booking_id)
  * explain_provider_requirements(vehicle_type)
  * create_support_ticket(summary)
- The assistant NEVER confirms a booking or payment without an explicit
  user tap. It never reveals other users' data or masked phone numbers.
- Guardrails: stay on topic (mobility, platform help), refuse unsafe
  requests, escalate emergencies to the SOS flow and local emergency numbers.

UX:
- Floating chat button on every main screen; quick-reply chips
  ("Book a moto", "Find a taxi", "Rent a car", "Become a driver").
- Works on low data: cache FAQs offline for common questions; queue messages
  when offline.
- Log conversations (anonymised) for quality review; thumbs up/down feedback.

ALSO USE AI FOR:
- Auto-translating provider service descriptions FR<->EN.
- Admin helper: summarise provider documents/risks (assistive, human decides).
```

---

## 12. PHASE 9 — ADMIN DASHBOARD

```
PHASE 9: Admin dashboard (apps/admin).

Modules: Overview KPIs | Providers (verification queue) | Vehicles | Services |
Bookings (live map + table) | Rentals | Users | Payments and payouts |
Pricing rules | Cities and zones | Promotions | Support tickets | SOS alerts |
AI settings and knowledge base | Content (FR/EN) | Audit log | Roles.

KPIs (from the GoBert brand strategy): registered passengers, monthly active
users, completed rides, booking acceptance rate, driver availability, average
pickup time, cancellation rate, gross booking value, platform revenue, driver
earnings, average rating, complaint resolution time, repeat booking rate.

Requirements: role-based access (admin, support), CSV export, filters by city
and vehicle type, real-time bookings map, every sensitive action in audit_log.
```

---

## 13. PHASE 10 — LOW-BANDWIDTH & OFFLINE OPTIMISATION

```
PHASE 10: Performance for low internet.

WEB:
- Budget: landing < 150 KB JS, passenger PWA first load < 250 KB gzip.
- PWA with Workbox: cache shell, fonts, FR/EN dictionaries, last directory
  results, offline fallback page, background sync for queued bookings.
- Image policy: WebP/AVIF, width-aware, lazy, blur placeholders; client-side
  compression before upload.
- Lighthouse CI thresholds in GitHub Actions (performance >= 85 on mobile).

MOBILE:
- drift/SQLite cache for providers, services, last trips, saved places.
- Offline map tiles for Bertoua. Small APK (split ABIs, R8 shrink), target < 25 MB.
- "Data saver mode": no photos except profile avatar, lower-frequency polling.
- Show clear connection state and what will sync later.

API:
- Select only needed columns, paginate, use compressed JSON, ETag caching.
- Rate limiting on Edge Functions, input validation with zod.
```

---

## 14. PHASE 11 — NOTIFICATIONS, SAFETY & TRUST

```
PHASE 11: Notifications and safety.

- Firebase Cloud Messaging for push (Flutter + web push).
- SMS gateway Edge Function with templates in FR/EN (OTP, driver assigned,
  arriving, trip receipt, document status).
- SOS button: sends location + trip details to emergency contacts and to
  admin/support dashboard in real time.
- Share-my-trip link (public tokenised page, expires on completion).
- Driver safety checks: verified badge, plate + photo match, rating thresholds,
  automatic suspension after repeated serious complaints (admin reviews).
- Report/block flow. Privacy page, Terms, data retention policy (Cameroon
  data-protection context), in-app consent screens.
```

---

## 15. PHASE 12 — TESTING & QUALITY

```
PHASE 12: Testing.

- Unit: Vitest (web), flutter_test (mobile), pgTAP (DB/RLS).
- Integration: Supabase local stack in CI; test booking state machine and
  concurrent accept.
- E2E: Playwright (web: onboarding, booking, admin approval), Patrol or
  integration_test (Flutter: booking happy path).
- Network chaos tests: throttle to Slow 3G / offline in Playwright; mobile
  tests with simulated disconnects.
- Accessibility: axe checks, minimum 48 dp touch targets, contrast >= 4.5:1.
- Security checklist: RLS on every table, no service_role in clients, secrets
  scan (gitleaks) in CI, dependency audit, storage policies verified.
- Load test the dispatch function (k6) with 200 simulated drivers.
```

---

## 16. CI/CD — GITHUB + VERCEL + SUPABASE

### 16.1 Branching
- `main` = production, protected (PR + green CI + 1 review).
- `develop` = staging.
- Feature branches: `feat/...`, `fix/...`.
- Vercel gives every PR a **preview deployment**.
- Use **two Supabase projects**: `gobert-staging` and `gobert-prod`.

### 16.2 GitHub secrets to add
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF_STAGING`, `SUPABASE_PROJECT_REF_PROD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_WEB`, `VERCEL_PROJECT_ID_ADMIN`, `ANTHROPIC_API_KEY` (stored in Supabase secrets, not in Actions unless needed for tests), `FCM_SERVICE_ACCOUNT`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `ANDROID_STORE_PASSWORD`.

### 16.3 Vercel setup
1. Import the GitHub repo twice: `apps/web` and `apps/admin` (set **Root Directory** accordingly, enable "Include files outside root" for the monorepo).
2. Environment variables (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_MAP_STYLE_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE=fr`. Server-only: `SUPABASE_SERVICE_ROLE_KEY` (admin app only).
3. Domains: `gobert.cm` (web), `admin.gobert.cm` (admin). Check domain availability first.

### 16.4 Workflow: web CI (`.github/workflows/ci-web.yml`)
```yaml
name: CI Web
on:
  pull_request:
  push:
    branches: [main, develop]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - name: Secret scan
        uses: gitleaks/gitleaks-action@v2
```

### 16.5 Workflow: Supabase deploy (`deploy-supabase.yml`)
```yaml
name: Deploy Supabase
on:
  push:
    branches: [main, develop]
    paths: ['supabase/**']
jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      PROJECT_REF: ${{ github.ref == 'refs/heads/main' && secrets.SUPABASE_PROJECT_REF_PROD || secrets.SUPABASE_PROJECT_REF_STAGING }}
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase link --project-ref $PROJECT_REF
      - run: supabase db push
      - run: supabase functions deploy --project-ref $PROJECT_REF
```

### 16.6 Workflow: Flutter (`ci-mobile.yml`)
```yaml
name: CI Mobile
on:
  pull_request:
    paths: ['mobile/**']
  push:
    branches: [main]
    paths: ['mobile/**']
jobs:
  flutter:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: mobile } }
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { channel: stable, cache: true }
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test
      - run: flutter build apk --release --flavor passenger --split-per-abi
      - run: flutter build apk --release --flavor driver --split-per-abi
      - uses: actions/upload-artifact@v4
        with:
          name: gobert-apks
          path: mobile/build/app/outputs/flutter-apk/*.apk
```

### 16.7 Release flow
1. PR -> CI green -> Vercel preview + staging Supabase.
2. Merge to `develop` -> staging deploy, test with real phones in Bertoua.
3. Merge `develop` -> `main` -> production deploy.
4. Tag `v1.0.0` -> build signed APK/AAB -> distribute through Play Console (internal testing) and **direct APK download + QR code** (very effective in Bertoua).

---

## 17. PHASE 13 — LAUNCH IN BERTOUA

```
PHASE 13: Launch readiness for "BERTOUA, LET'S MOVE!"

1. Seed production data: Bertoua city, zones/quartiers, landmarks, pricing.
2. Provider acquisition tooling: referral codes, QR onboarding poster pages,
   bulk invite via WhatsApp link, assisted onboarding mode for riders with
   limited digital literacy (admin or field agent registers on their behalf).
3. Pilot: 30 to 50 motorcycle taxis + 10 to 20 taxis/cars + a few tricycles
   and trucks. Partner with moto-taxi associations.
4. Customer support: in-app chat, WhatsApp Business number, complaint tracker.
5. Monitoring: Sentry (web + Flutter), Supabase logs, uptime check,
   PostHog or Plausible (privacy-friendly) for product analytics.
6. Backups: Supabase daily backups + weekly export; runbook in docs/RUNBOOK.md.
7. Legal pack: Terms, Privacy, driver agreement, rental agreement, commission
   policy. Have a Cameroonian lawyer review before launch.
8. Brand assets: logo (Connected G), app icons, store listings in FR/EN,
   driver stickers/vests/helmet IDs, social templates.
9. Expansion config: cities table already supports Ngaoundéré, Garoua and
   Maroua; activate by seeding zones, pricing and recruiting providers.
```

---

## 18. TROUBLESHOOTING PROMPTS (reuse in Cursor)

- **Bug:** "Reproduce, explain root cause, fix minimally, add a regression test, and confirm i18n + offline behaviour is unaffected."
- **Feature:** "Plan first (files, tables, RLS, i18n keys, offline behaviour), wait for my OK, then implement."
- **Security review:** "Audit this table/endpoint for RLS gaps, data leakage, injection and abuse. List risks by severity and fix."
- **Performance:** "Measure bundle size and request payloads for this screen on Slow 3G and propose reductions."

---

## 19. KEY DECISIONS TO CONFIRM EARLY

1. **Payment aggregator** (CinetPay, Notch Pay, Campay or direct MTN/Orange APIs): check fees, onboarding time and Cameroon coverage.
2. **SMS gateway** and sender ID registration in Cameroon.
3. **Map/routing hosting**: public OSRM/Nominatim for MVP, self-host later when volume grows.
4. **Commission model** and rider-friendly incentives for the first 90 days.
5. **Trademark and domain**: run OAPI trademark clearance and confirm ownership of the GoBert name (an earlier taxi-booking project of that name appears in your portfolio; clarify rights before public launch). A web search is not legal clearance.
6. **Regulatory**: confirm licensing and insurance requirements for ride-hailing, moto-taxi and goods transport with the relevant Cameroonian authorities.

---

## 20. FINAL STATEMENT

> **GoBert** is more than a way to get from one place to another. It is a platform for connecting people, enabling businesses, creating opportunities and moving communities forward.
>
> **GoBert — Move. Connect. Go.**
