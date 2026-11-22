# RLS Policies (plain language)

- profiles: users read/write only their own profile; admins read all.
- providers: public reads approved providers only; owners manage their own; admins manage all.
- provider_documents: only owner and admin can read/write; anonymous cannot read.
- vehicles/services: public reads approved; owners manage their own.
- bookings: passenger (auth or anon token) owns their booking; assigned provider can read; admin manages all.
- payments: passenger of the booking can read; admin manages.
- ratings: public read; only the booking's passenger can insert.
