# RLS Policies (plain language)

- profiles: users read/write only their own profile; admins read all.
- providers: public reads approved providers only; owners manage their own; admins manage all.
- provider_documents: only owner and admin can read/write; anonymous cannot read.
- vehicles/services: public reads approved; owners manage their own.
- bookings: passenger (auth or anon token) owns their booking; assigned provider can read; admin manages all.
- payments: passenger of the booking can read; admin manages.
- ratings: public read; only the booking's passenger can insert.

## Account types & verification (migration 202611250001)

- **Customers** have `profiles.role = 'passenger'` and `provider_kind = null`. They never need verification.
- **Riders** (owners/drivers of motos, taxis, tricycles, trucks) and **service providers** (delivery, rental, logistics companies) have `profiles.role = 'provider'` and `provider_kind = 'rider' | 'business'`, mirrored on `providers.kind`.
- A provider row starts as `draft`, the owner submits it (`pending`), and **only an admin** can move it to `approved`, `rejected`, `changes_requested` or `suspended`.
- **Security fix:** the original `providers self write` policy (`for all`) let an owner update every column of their own row, including `verification_status` — i.e. self-approval. The `providers_guard_moderation` trigger now rejects any non-admin change to `verification_status` (except draft/changes_requested/rejected → pending), `review_note`, `reviewed_*`, `rating_*`, and refuses `is_online = true` unless approved.
- `v_public_providers` only exposes approved providers, and only exposes `phone` / `whatsapp` when the provider set `accepts_direct_calls`.
