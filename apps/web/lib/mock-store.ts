// GoBert mock backend (server-side only — used by /app/api/mock/* route handlers).
// State lives on globalThis so it survives hot reloads, and is persisted to
// .mock-data/gobert.json (see mock-persist.ts) so it survives restarts.
//
// Never import runtime values from this file in client components; use the
// client API wrappers in lib/*-api.ts instead. `import type` is fine.

import { loadPersisted, persist } from "./mock-persist";
import { RIDER_SERVICES, PRIMARY_SERVICE, BUSINESS_PRIMARY, RIDER_DOCS, BUSINESS_DOCS } from "./domain";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "customer" | "rider" | "business" | "admin";
export type ProviderKind = "rider" | "business";
export type VehicleType = "moto" | "taxi" | "tricycle" | "truck" | "car_rental";
export type ServiceKey = "moto" | "ride" | "express" | "cargo" | "rent" | "logistics";
export type BusinessType = "delivery" | "car_rental" | "logistics" | "other";
export type PaymentMethod = "cash" | "mtn_momo" | "orange_money";
export type ProviderStatus = "pending" | "approved" | "rejected" | "changes_requested" | "suspended";

export type MockUser = {
  id: string;
  phone: string;
  full_name: string;
  role: UserRole;
  email: string | null;
  city: string;
  language: "fr" | "en";
  provider_id: string | null;
  is_blocked?: boolean;
  created_at: string;
  updated_at: string;
};

export type MockVehicle = {
  type: VehicleType;
  brand: string;
  model: string;
  plate: string;
  color: string;
  year?: number | null;
  seats?: number | null;
  payload_kg?: number | null;
};

export type BusinessInfo = {
  name: string;
  type: BusinessType;
  registration_number: string;
  tax_id: string;
  address: string;
  description: string;
};

export type Schedule = { days: number[]; start: string; end: string; is_24h: boolean };

export type RegistrationService = {
  type: ServiceKey;
  title_fr: string;
  title_en: string;
  base_price_xaf: number;
  price_per_km_xaf?: number;
  price_per_day_xaf?: number;
  zones: string[];
};

export type MockProvider = {
  id: string;
  kind: ProviderKind;
  owner_user_id: string | null;
  display_name: string;
  phone: string;
  whatsapp: string | null;
  city: string;
  bio: string;
  rating_avg: number;
  rating_count: number;
  trips_completed: number;
  earnings_xaf: number;
  accepts_direct_calls: boolean;
  is_online: boolean;
  verification_status: ProviderStatus;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  last_location: { lat: number; lng: number };
  /** Primary service (used for map marker colour / filters). */
  service: ServiceKey;
  services: ServiceKey[];
  service_details: RegistrationService[];
  vehicle: MockVehicle | null;
  business: BusinessInfo | null;
  schedule: Schedule;
  photo: string | null;
};

/** What customers (and anonymous visitors) may see about a provider. */
export type PublicProvider = Omit<MockProvider, "phone" | "whatsapp" | "owner_user_id" | "review_note" | "earnings_xaf"> & {
  phone: string | null;
  whatsapp: string | null;
};

export type BookingStatus =
  | "requested"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

export type MockBooking = {
  id: string;
  passenger_id: string;
  passenger_name: string | null;
  passenger_phone: string | null;
  provider_id: string | null;
  declined_by: string[];
  vehicle_type: VehicleType;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  fare_estimate_xaf: number;
  fare_final_xaf: number | null;
  distance_m: number;
  eta_min: number;
  payment_method: PaymentMethod;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  rating: number | null;
  rating_comment: string | null;
};

export type RegistrationDocument = {
  type: string;
  name: string;
  size: number;
  /** Inline preview (mock mode) — empty once uploaded to storage. */
  data_url: string;
  /** Path in the private provider-docs bucket (Supabase mode). */
  storage_path?: string;
};

export type FleetInput = {
  type: RentalVehicleType;
  brand: string;
  model: string;
  plate: string;
  price_per_hour_xaf: number;
  price_per_day_xaf: number;
  deposit_xaf: number;
  with_driver: boolean;
  seats?: number | null;
  photo?: string | null;
};

export type RegistrationData = {
  kind?: ProviderKind;
  full_name?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  bio?: string;
  accepts_direct_calls?: boolean;
  // rider
  vehicle_type?: VehicleType;
  brand?: string;
  model?: string;
  plate?: string;
  color?: string;
  year?: number;
  seats?: number;
  payload_kg?: number;
  vehicle_photo?: string | null;
  // business
  business_name?: string;
  business_type?: BusinessType;
  registration_number?: string;
  tax_id?: string;
  address?: string;
  description?: string;
  fleet?: FleetInput[];
  // shared
  documents?: RegistrationDocument[];
  services?: RegistrationService[];
  schedule?: Schedule;
};

export type RegistrationDraft = {
  id: string;
  user_id: string;
  step: number;
  data: RegistrationData;
  status: "draft" | "submitted";
  provider_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditEntry = {
  id: string;
  provider_id: string | null;
  draft_id: string | null;
  decision: string;
  reason: string | null;
  at: string;
};

export type NotificationKind =
  | "provider_submitted"
  | "provider_approved"
  | "provider_rejected"
  | "provider_changes_requested"
  | "provider_suspended"
  | "booking_accepted"
  | "rental_requested"
  | "rental_confirmed"
  | "rental_declined"
  | "parcel_accepted"
  | "parcel_delivered";

export type MockNotification = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  params: Record<string, string>;
  at: string;
  read: boolean;
};

// ---------------- Rent & Express ----------------

export type RentalVehicleType = "car" | "truck" | "van" | "moto" | "tricycle";

export type RentalVehicle = {
  id: string;
  provider_id: string;
  provider_name: string;
  type: RentalVehicleType;
  brand: string;
  model: string;
  plate: string;
  photo: string | null;
  seats: number | null;
  price_per_hour_xaf: number;
  price_per_day_xaf: number;
  with_driver: boolean;
  deposit_xaf: number;
  available: boolean;
};

export type RentalStatus = "requested" | "confirmed" | "declined" | "active" | "completed" | "cancelled";

export type RentalRequest = {
  id: string;
  vehicle_id: string;
  vehicle_label: string;
  provider_id: string;
  customer_user_id: string | null;
  customer_name: string;
  phone: string;
  start_date: string;
  end_date: string;
  with_driver: boolean;
  total_xaf: number;
  deposit_xaf: number;
  status: RentalStatus;
  created_at: string;
  updated_at: string;
};

export type ParcelSize = "small" | "medium" | "large";
export type ParcelStatus = "requested" | "accepted" | "in_transit" | "delivered" | "cancelled";

export type ExpressParcel = {
  id: string;
  sender_user_id: string | null;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  size: ParcelSize;
  notes: string | null;
  photo: string | null;
  fare_xaf: number;
  otp: string;
  status: ParcelStatus;
  provider_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AISettings = {
  enabled: boolean;
  model: string;
  system_prompt: string;
  rate_limit: number;
  usage: { requests: number; input_tokens: number; output_tokens: number };
};

type MockState = {
  version: number;
  users: MockUser[];
  providers: MockProvider[];
  bookings: MockBooking[];
  drafts: RegistrationDraft[];
  audit: AuditEntry[];
  documents: (RegistrationDocument & { id: string; provider_id: string | null })[];
  rentals: RentalVehicle[];
  rentalRequests: RentalRequest[];
  parcels: ExpressParcel[];
  notifications: MockNotification[];
  aiSettings: AISettings;
};

const STATE_VERSION = 3;

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

export const BERTOUA_CENTER = { lat: 4.5774, lng: 13.6846 };

const DEFAULT_SCHEDULE: Schedule = { days: [1, 2, 3, 4, 5, 6], start: "06:00", end: "22:00", is_24h: false };

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\s/g, "");
  if (d.length < 6) return "•••";
  return `${d.slice(0, 5)} ••• ••${d.slice(-2)}`;
}

function autopilotEnabled(): boolean {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return false;
  return process.env.GOBERT_AUTOPILOT !== "false";
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const NAMES = [
  "Mbarga Jean", "Nkoulou Marie", "Tchoumi Paul", "Etoa Bernard", "Mballa Rose",
  "Nkeng Samuel", "Tanyi Grace", "Fouda Pierre", "Manga Alice", "Ngo Bell",
  "Tchinda Joseph", "Ekema Sylvie", "Nkolo David", "Mbah Eric", "Toche Clarisse",
  "Ngambe Serge", "Etoundi Jeanne", "Mballa Yves", "Nkoulou Jean", "Tchoumi Alain",
  "Etoa Marie", "Mballa Paul", "Nkeng Rose", "Tanyi Bernard", "Fouda Grace",
  "Ngambe Paul", "Etoundi Marie", "Mballa Jean", "Nkoulou Alain", "Tchoumi Rose",
];
const TYPES: Exclude<VehicleType, "car_rental">[] = [
  "moto", "moto", "moto", "moto", "moto", "moto", "moto", "moto", "moto", "moto",
  "moto", "moto", "moto", "moto", "moto", "taxi", "taxi", "taxi", "taxi", "taxi",
  "taxi", "tricycle", "tricycle", "truck", "truck",
  "moto", "taxi", "tricycle", "truck", "moto",
];
const VEHICLE_INFO: Record<VehicleType, { brand: string; model: string; color: string }> = {
  moto: { brand: "Sanya", model: "SY 125", color: "Rouge" },
  taxi: { brand: "Toyota", model: "Corolla", color: "Jaune" },
  tricycle: { brand: "Bajaj", model: "RE", color: "Bleu" },
  truck: { brand: "Renault", model: "Master", color: "Blanc" },
  car_rental: { brand: "Toyota", model: "Hilux", color: "Blanc" },
};
const QUARTERS = ["Centre", "Mokolo", "Tigaza", "Enia", "Nkolbikon", "Ndemba", "Kpokolota", "Monou"];

function seedRiders(): MockProvider[] {
  return NAMES.map((name, idx) => {
    const i = idx + 1;
    const type = TYPES[idx];
    const info = VEHICLE_INFO[type];
    const approved = idx < 25;
    const services = RIDER_SERVICES[type];
    const base = type === "moto" ? 300 : type === "taxi" ? 500 : type === "tricycle" ? 400 : 2000;
    return {
      id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      kind: "rider",
      owner_user_id: null,
      display_name: name,
      phone: `+2376990000${String(i).padStart(2, "0")}`,
      whatsapp: i % 2 === 0 ? `+2376990000${String(i).padStart(2, "0")}` : null,
      city: "Bertoua",
      bio: "",
      rating_avg: approved ? Math.round((4.2 + (i % 7) * 0.1) * 10) / 10 : 0,
      rating_count: approved ? 5 + i * 3 : 0,
      trips_completed: approved ? 20 + i * 7 : 0,
      earnings_xaf: approved ? (20 + i * 7) * 900 : 0,
      accepts_direct_calls: i % 2 === 0,
      is_online: approved && i % 3 !== 0,
      verification_status: approved ? "approved" : "pending",
      review_note: null,
      submitted_at: now(),
      reviewed_at: approved ? now() : null,
      last_location: {
        lat: BERTOUA_CENTER.lat + ((i % 7) - 3) * 0.006,
        lng: BERTOUA_CENTER.lng + ((i % 5) - 2) * 0.008,
      },
      service: PRIMARY_SERVICE[type],
      services,
      service_details: services.map((s) => ({
        type: s,
        title_fr: s,
        title_en: s,
        base_price_xaf: base,
        price_per_km_xaf: type === "truck" ? 300 : 100,
        zones: ["Bertoua", QUARTERS[i % QUARTERS.length]],
      })),
      vehicle: {
        type,
        brand: info.brand,
        model: info.model,
        color: info.color,
        plate: `ES ${100 + i * 7} ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}`,
        year: 2015 + (i % 9),
      },
      business: null,
      schedule: i % 4 === 0 ? { days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59", is_24h: true } : DEFAULT_SCHEDULE,
      photo: `https://i.pravatar.cc/150?img=${(i % 60) + 1}`,
    };
  });
}

function seedBusinesses(): MockProvider[] {
  const defs: { name: string; type: BusinessType; services: ServiceKey[]; status: ProviderStatus; bio: string }[] = [
    { name: "Bertoua Auto Location", type: "car_rental", services: ["rent"], status: "approved", bio: "Location de voitures et minibus, avec ou sans chauffeur." },
    { name: "EST Logistique & Transport", type: "logistics", services: ["logistics", "cargo", "rent"], status: "approved", bio: "Transport de marchandises dans l'Est et vers Yaoundé." },
    { name: "Rapide Express Bertoua", type: "delivery", services: ["express"], status: "approved", bio: "Livraison de colis en ville en moins d'une heure." },
    { name: "Kadey Cargo SARL", type: "logistics", services: ["cargo", "rent"], status: "pending", bio: "Camions et fourgons pour vos chantiers." },
  ];
  return defs.map((d, i) => ({
    id: `10000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
    kind: "business",
    owner_user_id: null,
    display_name: d.name,
    phone: `+2376770000${String(i + 1).padStart(2, "0")}`,
    whatsapp: `+2376770000${String(i + 1).padStart(2, "0")}`,
    city: "Bertoua",
    bio: d.bio,
    rating_avg: d.status === "approved" ? 4.6 - i * 0.1 : 0,
    rating_count: d.status === "approved" ? 40 - i * 8 : 0,
    trips_completed: d.status === "approved" ? 120 - i * 30 : 0,
    earnings_xaf: 0,
    accepts_direct_calls: true,
    is_online: d.status === "approved",
    verification_status: d.status,
    review_note: null,
    submitted_at: now(),
    reviewed_at: d.status === "approved" ? now() : null,
    last_location: { lat: BERTOUA_CENTER.lat + 0.004 * (i - 1), lng: BERTOUA_CENTER.lng - 0.005 * (i - 1) },
    service: BUSINESS_PRIMARY[d.type],
    services: d.services,
    service_details: d.services.map((s) => ({
      type: s,
      title_fr: s,
      title_en: s,
      base_price_xaf: s === "express" ? 500 : s === "rent" ? 15000 : 5000,
      zones: ["Bertoua", "Région de l'Est"],
    })),
    vehicle: null,
    business: {
      name: d.name,
      type: d.type,
      registration_number: `RC/BTA/2024/B/${100 + i}`,
      tax_id: `M0${i + 1}24000${i + 3}21P`,
      address: `Quartier ${QUARTERS[i]}, Bertoua`,
      description: d.bio,
    },
    schedule: DEFAULT_SCHEDULE,
    photo: null,
  }));
}

function seedRentals(businesses: MockProvider[]): RentalVehicle[] {
  const [autoLoc, estLog, , kadey] = businesses;
  const defs: { p: MockProvider; type: RentalVehicleType; brand: string; model: string; perH: number; perD: number; driver: boolean; seats: number | null }[] = [
    { p: autoLoc, type: "car", brand: "Toyota", model: "Corolla", perH: 3000, perD: 15000, driver: true, seats: 5 },
    { p: autoLoc, type: "car", brand: "Hyundai", model: "Accent", perH: 2500, perD: 12000, driver: false, seats: 5 },
    { p: autoLoc, type: "van", brand: "Toyota", model: "Hiace", perH: 4000, perD: 20000, driver: true, seats: 14 },
    { p: estLog, type: "truck", brand: "Renault", model: "Master", perH: 6000, perD: 30000, driver: true, seats: 3 },
    { p: estLog, type: "truck", brand: "Iveco", model: "Daily", perH: 5500, perD: 28000, driver: true, seats: 3 },
    { p: kadey, type: "van", brand: "Mercedes", model: "Sprinter", perH: 4500, perD: 22000, driver: false, seats: 3 },
  ];
  return defs.map((d, i) => ({
    id: `rent-${i + 1}`,
    provider_id: d.p.id,
    provider_name: d.p.display_name,
    type: d.type,
    brand: d.brand,
    model: d.model,
    plate: `ES ${500 + i * 13} RT`,
    photo: null,
    seats: d.seats,
    price_per_hour_xaf: d.perH,
    price_per_day_xaf: d.perD,
    with_driver: d.driver,
    deposit_xaf: d.perD * 2,
    available: true,
  }));
}

function initialState(): MockState {
  const riders = seedRiders();
  const businesses = seedBusinesses();
  return {
    version: STATE_VERSION,
    users: [],
    providers: [...riders, ...businesses],
    bookings: [],
    drafts: [],
    audit: [],
    documents: [],
    rentals: seedRentals(businesses),
    rentalRequests: [],
    parcels: [],
    notifications: [],
    aiSettings: {
      enabled: true,
      model: "claude-sonnet-5-5",
      system_prompt: "You are the GoBert assistant, a helpful mobility assistant for Bertoua, Cameroon.",
      rate_limit: 20,
      usage: { requests: 0, input_tokens: 0, output_tokens: 0 },
    },
  };
}

const g = globalThis as unknown as { __GB_MOCK__?: MockState };
if (!g.__GB_MOCK__ || g.__GB_MOCK__.version !== STATE_VERSION) {
  const persisted = loadPersisted<MockState>();
  g.__GB_MOCK__ = persisted && persisted.version === STATE_VERSION ? persisted : initialState();
}
const store = g.__GB_MOCK__!;

function save() {
  persist(store);
}

/** Test helper: reset to seed data. */
export function __resetStore() {
  Object.assign(store, initialState());
}

function notify(userId: string | null, kind: NotificationKind, params: Record<string, string> = {}) {
  if (!userId) return;
  store.notifications.push({ id: uid(), user_id: userId, kind, params, at: now(), read: false });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function getUser(id: string): MockUser | undefined {
  return store.users.find((u) => u.id === id);
}

export function listUsers(role?: UserRole): MockUser[] {
  return role ? store.users.filter((u) => u.role === role) : store.users;
}

export function upsertUser(input: {
  id: string;
  phone: string;
  full_name: string;
  role: UserRole;
  email?: string | null;
  city?: string;
  language?: "fr" | "en";
}): MockUser {
  const existing = getUser(input.id);
  const t = now();
  if (existing) {
    existing.full_name = input.full_name || existing.full_name;
    existing.email = input.email ?? existing.email;
    existing.city = input.city || existing.city;
    existing.language = input.language ?? existing.language;
    // The role is chosen once at registration; it cannot be switched silently.
    existing.updated_at = t;
    save();
    return existing;
  }
  const user: MockUser = {
    id: input.id,
    phone: input.phone,
    full_name: input.full_name.trim(),
    role: input.role,
    email: input.email?.trim() || null,
    city: input.city || "Bertoua",
    language: input.language ?? "fr",
    provider_id: null,
    created_at: t,
    updated_at: t,
  };
  store.users.push(user);
  save();
  return user;
}

export function updateUser(
  id: string,
  patch: Partial<Pick<MockUser, "full_name" | "email" | "city" | "language">>,
): MockUser | null {
  const u = getUser(id);
  if (!u) return null;
  if (patch.full_name !== undefined && patch.full_name.trim()) u.full_name = patch.full_name.trim();
  if (patch.email !== undefined) u.email = patch.email?.trim() || null;
  if (patch.city !== undefined && patch.city.trim()) u.city = patch.city.trim();
  if (patch.language === "fr" || patch.language === "en") u.language = patch.language;
  u.updated_at = now();
  if (u.provider_id) {
    const p = getProvider(u.provider_id);
    if (p && p.kind === "rider" && patch.full_name?.trim()) p.display_name = patch.full_name.trim();
  }
  save();
  return u;
}

export function getNotifications(userId: string): MockNotification[] {
  return store.notifications.filter((n) => n.user_id === userId).slice(-30).reverse();
}

export function markNotificationsRead(userId: string) {
  store.notifications.forEach((n) => {
    if (n.user_id === userId) n.read = true;
  });
  save();
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export function getProviders(): MockProvider[] {
  return store.providers;
}

export function getProvider(id: string): MockProvider | undefined {
  return store.providers.find((p) => p.id === id);
}

export function getProviderByUser(userId: string): MockProvider | undefined {
  return store.providers.find((p) => p.owner_user_id === userId);
}

export function toPublicProvider(p: MockProvider): PublicProvider {
  const { phone, whatsapp } = p;
  const rest = { ...p } as Partial<MockProvider>;
  delete rest.owner_user_id;
  delete rest.review_note;
  delete rest.earnings_xaf;
  return {
    ...(rest as Omit<MockProvider, "owner_user_id" | "review_note" | "earnings_xaf">),
    // Phone numbers are only exposed when the provider opted into direct calls.
    phone: p.accepts_direct_calls ? phone : null,
    whatsapp: p.accepts_direct_calls ? whatsapp : null,
  };
}

/** Approved providers only — the only ones customers can ever see. */
export function getPublicProviders(opts: { onlineOnly?: boolean; service?: ServiceKey; kind?: ProviderKind } = {}): PublicProvider[] {
  return store.providers
    .filter((p) => p.verification_status === "approved")
    .filter((p) => (opts.onlineOnly ? p.is_online : true))
    .filter((p) => (opts.service ? p.services.includes(opts.service) : true))
    .filter((p) => (opts.kind ? p.kind === opts.kind : true))
    .map(toPublicProvider);
}

/** Only approved providers may go online. Returns false otherwise. */
export function setProviderOnline(id: string, isOnline: boolean, loc?: { lat: number; lng: number }): boolean {
  const p = store.providers.find((x) => x.id === id);
  if (!p) return false;
  if (isOnline && p.verification_status !== "approved") return false;
  p.is_online = isOnline;
  if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) p.last_location = loc;
  save();
  return true;
}

export function updateProviderSettings(
  id: string,
  patch: Partial<Pick<MockProvider, "accepts_direct_calls" | "whatsapp" | "bio" | "schedule">>,
): MockProvider | null {
  const p = getProvider(id);
  if (!p) return null;
  if (patch.accepts_direct_calls !== undefined) p.accepts_direct_calls = !!patch.accepts_direct_calls;
  if (patch.whatsapp !== undefined) p.whatsapp = patch.whatsapp || null;
  if (patch.bio !== undefined) p.bio = patch.bio;
  if (patch.schedule) p.schedule = patch.schedule;
  save();
  return p;
}

// ---------------------------------------------------------------------------
// Fares
// ---------------------------------------------------------------------------

const PRICING: Record<VehicleType, { base: number; perKm: number; perMin: number; min: number }> = {
  moto: { base: 300, perKm: 100, perMin: 25, min: 500 },
  taxi: { base: 500, perKm: 150, perMin: 30, min: 800 },
  tricycle: { base: 400, perKm: 120, perMin: 25, min: 600 },
  truck: { base: 1000, perKm: 300, perMin: 50, min: 2000 },
  car_rental: { base: 5000, perKm: 200, perMin: 50, min: 5000 },
};

export function estimateFare(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  vtype: VehicleType,
) {
  const distM = haversineM(pickup, dropoff);
  const km = distM / 1000;
  const rule = PRICING[vtype] ?? PRICING.moto;
  // ~25 km/h average urban speed
  const minutes = Math.max(2, Math.round((km / 25) * 60));
  const raw = rule.base + rule.perKm * km + rule.perMin * minutes;
  const fare = Math.max(rule.min, Math.round(raw / 25) * 25);
  return { fare_estimate_xaf: fare, distance_m: distM, eta_min: minutes };
}

// ---------------------------------------------------------------------------
// Bookings (dispatch)
// ---------------------------------------------------------------------------

const BOOKING_EXPIRY_S = 120;

export function createBooking(input: {
  passenger_id: string;
  vehicle_type: VehicleType;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  payment_method?: PaymentMethod;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  notes?: string | null;
}): MockBooking {
  const est = estimateFare(input.pickup, input.dropoff, input.vehicle_type);
  const t = now();
  const booking: MockBooking = {
    id: uid(),
    passenger_id: input.passenger_id,
    passenger_name: input.passenger_name ?? null,
    passenger_phone: input.passenger_phone ?? null,
    provider_id: null,
    declined_by: [],
    vehicle_type: input.vehicle_type,
    pickup: input.pickup,
    dropoff: input.dropoff,
    fare_estimate_xaf: est.fare_estimate_xaf,
    fare_final_xaf: null,
    distance_m: est.distance_m,
    eta_min: est.eta_min,
    payment_method: input.payment_method ?? "cash",
    notes: input.notes ?? null,
    status: "requested",
    created_at: t,
    updated_at: t,
    accepted_at: null,
    arrived_at: null,
    started_at: null,
    completed_at: null,
    rating: null,
    rating_comment: null,
  };
  store.bookings.push(booking);
  save();
  return booking;
}

export function getBooking(id: string): MockBooking | undefined {
  tick();
  return store.bookings.find((b) => b.id === id);
}

export function listBookingsForPassenger(passengerId: string): MockBooking[] {
  tick();
  return store.bookings.filter((b) => b.passenger_id === passengerId).slice().reverse();
}

export function listBookingsForProvider(providerId: string): MockBooking[] {
  return store.bookings.filter((b) => b.provider_id === providerId).slice().reverse();
}

export function listAllBookings(): MockBooking[] {
  tick();
  return store.bookings.slice().reverse();
}

/** Single-winner accept: only one approved, online provider can win a requested booking. */
export function acceptBooking(bookingId: string, providerId: string): boolean {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b || b.status !== "requested") return false;
  const p = store.providers.find((x) => x.id === providerId);
  if (!p || !p.is_online || p.verification_status !== "approved") return false;
  b.provider_id = providerId;
  b.status = "accepted";
  b.accepted_at = now();
  b.updated_at = b.accepted_at;
  notify(b.passenger_id, "booking_accepted", { provider: p.display_name });
  save();
  return true;
}

export function declineBooking(bookingId: string, providerId: string): void {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (b && b.status === "requested" && !b.declined_by.includes(providerId)) {
    b.declined_by.push(providerId);
    b.updated_at = now();
    save();
  }
}

function completeBooking(b: MockBooking) {
  b.status = "completed";
  b.completed_at = now();
  b.fare_final_xaf = b.fare_estimate_xaf;
  const p = b.provider_id ? getProvider(b.provider_id) : undefined;
  if (p) {
    p.trips_completed += 1;
    p.earnings_xaf += b.fare_final_xaf;
  }
}

export function setBookingStatus(bookingId: string, status: BookingStatus): boolean {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b) return false;
  const t = now();
  if (status === "arriving" && b.status === "accepted") {
    b.status = "arriving";
    b.arrived_at = t;
  } else if (status === "in_progress" && (b.status === "arriving" || b.status === "accepted")) {
    b.status = "in_progress";
    b.started_at = t;
  } else if (status === "completed" && (b.status === "in_progress" || b.status === "arriving")) {
    completeBooking(b);
  } else if (status === "cancelled" && ["requested", "accepted", "arriving"].includes(b.status)) {
    b.status = "cancelled";
  } else {
    return false;
  }
  b.updated_at = t;
  save();
  return true;
}

export function rateBooking(bookingId: string, stars: number, comment: string): boolean {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b || b.status !== "completed") return false;
  const value = Math.max(1, Math.min(5, Math.round(stars)));
  const p = b.provider_id ? getProvider(b.provider_id) : undefined;
  if (p) {
    // Replace a previous rating for this booking instead of double counting.
    const total = p.rating_avg * p.rating_count - (b.rating ?? 0) + value;
    const count = p.rating_count + (b.rating == null ? 1 : 0);
    p.rating_count = count;
    p.rating_avg = Math.round((total / count) * 10) / 10;
  }
  b.rating = value;
  b.rating_comment = comment || null;
  b.updated_at = now();
  save();
  return true;
}

/** Requested bookings near an approved rider whose vehicle matches the request. */
export function getIncomingForProvider(providerId: string): MockBooking[] {
  tick();
  const p = store.providers.find((x) => x.id === providerId);
  if (!p || p.verification_status !== "approved" || !p.is_online || !p.vehicle) return [];
  const vtype = p.vehicle.type;
  return store.bookings.filter((b) => {
    if (b.status !== "requested") return false;
    if (b.provider_id && b.provider_id !== providerId) return false;
    if (b.declined_by.includes(providerId)) return false;
    if (b.vehicle_type !== vtype) return false;
    return haversineM(p.last_location, b.pickup) < 8000;
  });
}

// ---------------------------------------------------------------------------
// Demo autopilot: seeded (non-user) providers accept and progress requests so
// a single person can demo the customer flow. Real riders always get first dibs.
// ---------------------------------------------------------------------------

const AUTO_ACCEPT_AFTER_S = 15;

function ageS(iso: string | null): number {
  return iso ? (Date.now() - new Date(iso).getTime()) / 1000 : 0;
}

function tick() {
  let changed = false;
  for (const b of store.bookings) {
    if (b.status === "requested" && ageS(b.created_at) > BOOKING_EXPIRY_S) {
      b.status = "expired";
      b.updated_at = now();
      changed = true;
    }
  }
  if (!autopilotEnabled()) {
    if (changed) save();
    return;
  }
  for (const b of store.bookings) {
    if (b.status === "requested" && ageS(b.created_at) > AUTO_ACCEPT_AFTER_S) {
      const candidate = store.providers
        .filter(
          (p) =>
            !p.owner_user_id &&
            p.kind === "rider" &&
            p.verification_status === "approved" &&
            p.is_online &&
            p.vehicle?.type === b.vehicle_type &&
            !b.declined_by.includes(p.id),
        )
        .sort((x, y) => haversineM(x.last_location, b.pickup) - haversineM(y.last_location, b.pickup))[0];
      if (candidate) {
        acceptBooking(b.id, candidate.id);
        changed = true;
      }
    }
    const p = b.provider_id ? getProvider(b.provider_id) : undefined;
    if (!p || p.owner_user_id) continue; // real riders drive their own trips
    if (b.status === "accepted" && ageS(b.accepted_at) > 15) {
      b.status = "arriving";
      b.arrived_at = now();
      changed = true;
    } else if (b.status === "arriving" && ageS(b.arrived_at) > 12) {
      b.status = "in_progress";
      b.started_at = now();
      changed = true;
    } else if (b.status === "in_progress" && ageS(b.started_at) > 20) {
      completeBooking(b);
      changed = true;
    }
  }
  for (const r of store.rentalRequests) {
    const p = getProvider(r.provider_id);
    if (r.status === "requested" && p && !p.owner_user_id && ageS(r.created_at) > 12) {
      r.status = "confirmed";
      r.updated_at = now();
      notify(r.customer_user_id, "rental_confirmed", { vehicle: r.vehicle_label });
      changed = true;
    }
  }
  for (const parcel of store.parcels) {
    if (parcel.status === "requested" && ageS(parcel.created_at) > 20) {
      const courier = store.providers.find(
        (p) => !p.owner_user_id && p.verification_status === "approved" && p.kind === "business" && p.services.includes("express"),
      );
      if (courier) {
        parcel.status = "accepted";
        parcel.provider_id = courier.id;
        parcel.updated_at = now();
        notify(parcel.sender_user_id, "parcel_accepted", { provider: courier.display_name });
        changed = true;
      }
    } else if (parcel.status === "accepted" && ageS(parcel.updated_at) > 20) {
      const p = parcel.provider_id ? getProvider(parcel.provider_id) : undefined;
      if (p && !p.owner_user_id) {
        parcel.status = "in_transit";
        parcel.updated_at = now();
        changed = true;
      }
    }
  }
  if (changed) save();
}

// ---------------------------------------------------------------------------
// Registration (rider & business onboarding)
// ---------------------------------------------------------------------------

export function saveDraft(
  draftId: string | null,
  userId: string,
  step: number,
  data: RegistrationData,
): RegistrationDraft {
  const t = now();
  const existing =
    (draftId && store.drafts.find((d) => d.id === draftId)) ||
    store.drafts.find((d) => d.user_id === userId && userId !== "anon");
  if (existing) {
    existing.step = step;
    existing.data = { ...existing.data, ...data };
    existing.updated_at = t;
    save();
    return existing;
  }
  const draft: RegistrationDraft = {
    id: uid(),
    user_id: userId,
    step,
    data,
    status: "draft",
    provider_id: null,
    created_at: t,
    updated_at: t,
  };
  store.drafts.push(draft);
  save();
  return draft;
}

export function getDraft(id: string): RegistrationDraft | undefined {
  return store.drafts.find((d) => d.id === id);
}

export function getDraftByUser(userId: string): RegistrationDraft | undefined {
  return store.drafts.find((d) => d.user_id === userId);
}

export function getDraftByProvider(providerId: string): RegistrationDraft | undefined {
  return store.drafts.find((d) => d.provider_id === providerId);
}

export type DraftValidation = { ok: boolean; missing: string[] };

export function validateRegistration(data: RegistrationData): DraftValidation {
  const missing: string[] = [];
  const kind = data.kind ?? "rider";
  if (!data.full_name?.trim()) missing.push("full_name");
  if (!data.phone?.trim()) missing.push("phone");
  if (kind === "rider") {
    if (!data.vehicle_type) missing.push("vehicle_type");
    if (!data.plate?.trim()) missing.push("plate");
    for (const doc of RIDER_DOCS.filter((d) => d.required)) {
      if (!data.documents?.some((d) => d.type === doc.type)) missing.push(`doc:${doc.type}`);
    }
  } else {
    if (!data.business_name?.trim()) missing.push("business_name");
    if (!data.business_type) missing.push("business_type");
    if (!data.registration_number?.trim()) missing.push("registration_number");
    for (const doc of BUSINESS_DOCS.filter((d) => d.required)) {
      if (!data.documents?.some((d) => d.type === doc.type)) missing.push(`doc:${doc.type}`);
    }
  }
  if (!data.services?.length) missing.push("services");
  return { ok: missing.length === 0, missing };
}

/**
 * Turns a draft into a provider in "pending" state. If the user already has a
 * provider (e.g. after "changes requested"), it is updated and re-queued.
 */
export function submitDraft(draftId: string): MockProvider | null {
  const draft = store.drafts.find((d) => d.id === draftId);
  if (!draft) return null;
  const t = now();
  const data = draft.data;
  const kind: ProviderKind = data.kind ?? "rider";
  const user = getUser(draft.user_id);
  const vtype = (data.vehicle_type ?? "moto") as VehicleType;
  const info = VEHICLE_INFO[vtype];
  const services: ServiceKey[] = data.services?.length
    ? Array.from(new Set(data.services.map((s) => s.type)))
    : kind === "rider"
      ? [PRIMARY_SERVICE[vtype]]
      : [BUSINESS_PRIMARY[data.business_type ?? "other"]];
  const primary: ServiceKey =
    kind === "rider"
      ? services.includes(PRIMARY_SERVICE[vtype])
        ? PRIMARY_SERVICE[vtype]
        : services[0]
      : services.includes(BUSINESS_PRIMARY[data.business_type ?? "other"])
        ? BUSINESS_PRIMARY[data.business_type ?? "other"]
        : services[0];

  const existing =
    (draft.provider_id && getProvider(draft.provider_id)) || (user?.provider_id && getProvider(user.provider_id)) || undefined;
  const i = store.providers.length + 1;

  const fields: Omit<MockProvider, "id" | "rating_avg" | "rating_count" | "trips_completed" | "earnings_xaf" | "last_location" | "photo"> = {
    kind,
    owner_user_id: draft.user_id !== "anon" ? draft.user_id : null,
    display_name: (kind === "business" ? data.business_name : data.full_name)?.trim() || "Nouveau prestataire",
    phone: data.phone?.trim() || user?.phone || "",
    whatsapp: data.whatsapp?.trim() || null,
    city: data.city?.trim() || user?.city || "Bertoua",
    bio: (kind === "business" ? data.description : data.bio)?.trim() || "",
    accepts_direct_calls: data.accepts_direct_calls ?? true,
    is_online: false,
    verification_status: "pending",
    review_note: null,
    submitted_at: t,
    reviewed_at: null,
    service: primary,
    services,
    service_details: data.services ?? [],
    vehicle:
      kind === "rider"
        ? {
            type: vtype,
            brand: data.brand?.trim() || info.brand,
            model: data.model?.trim() || info.model,
            color: data.color?.trim() || info.color,
            plate: data.plate?.trim().toUpperCase() || `ES ${100 + i} AA`,
            year: data.year ?? null,
            seats: data.seats ?? null,
            payload_kg: data.payload_kg ?? null,
          }
        : null,
    business:
      kind === "business"
        ? {
            name: data.business_name?.trim() || "",
            type: data.business_type ?? "other",
            registration_number: data.registration_number?.trim() || "",
            tax_id: data.tax_id?.trim() || "",
            address: data.address?.trim() || "",
            description: data.description?.trim() || "",
          }
        : null,
    schedule: data.schedule ?? DEFAULT_SCHEDULE,
  };

  let provider: MockProvider;
  if (existing) {
    Object.assign(existing, fields);
    provider = existing;
    store.documents = store.documents.filter((d) => d.provider_id !== provider.id);
  } else {
    provider = {
      ...fields,
      id: uid(),
      rating_avg: 0,
      rating_count: 0,
      trips_completed: 0,
      earnings_xaf: 0,
      last_location: {
        lat: BERTOUA_CENTER.lat + ((i % 7) - 3) * 0.004,
        lng: BERTOUA_CENTER.lng + ((i % 5) - 2) * 0.004,
      },
      photo: data.vehicle_photo ?? null,
    };
    store.providers.push(provider);
  }

  for (const doc of data.documents ?? []) {
    store.documents.push({ ...doc, id: uid(), provider_id: provider.id });
  }

  // Business fleet → rental listings (hidden until the business is approved).
  if (kind === "business" && data.fleet?.length) {
    store.rentals = store.rentals.filter((r) => r.provider_id !== provider.id);
    for (const f of data.fleet) addRentalVehicle(provider.id, f, false);
  }

  draft.status = "submitted";
  draft.provider_id = provider.id;
  draft.updated_at = t;
  if (user) {
    user.provider_id = provider.id;
    user.updated_at = t;
  }
  notify(draft.user_id, "provider_submitted", { name: provider.display_name });
  save();
  return provider;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function adminLogin(email: string, password: string): boolean {
  const expectedEmail = process.env.GOBERT_ADMIN_EMAIL ?? "admin@gobert.cm";
  const expectedPassword = process.env.GOBERT_ADMIN_PASSWORD ?? "admin123";
  return email.trim().toLowerCase() === expectedEmail && password === expectedPassword;
}

export function getQueue(status?: ProviderStatus, kind?: ProviderKind): MockProvider[] {
  return store.providers
    .filter((p) => (status ? p.verification_status === status : true))
    .filter((p) => (kind ? p.kind === kind : true))
    .slice()
    .sort((a, b) => {
      // pending first, newest first
      const pa = a.verification_status === "pending" ? 0 : 1;
      const pb = b.verification_status === "pending" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return b.submitted_at.localeCompare(a.submitted_at);
    });
}

export function getProviderDetail(providerId: string) {
  const provider = store.providers.find((p) => p.id === providerId);
  if (!provider) return null;
  const documents = store.documents.filter((d) => d.provider_id === providerId);
  const draft = getDraftByProvider(providerId);
  const owner = provider.owner_user_id ? getUser(provider.owner_user_id) ?? null : null;
  const fleet = store.rentals.filter((r) => r.provider_id === providerId);
  const audit = store.audit.filter((a) => a.provider_id === providerId).slice().reverse();
  return { provider, documents, draft: draft ?? null, owner, fleet, audit };
}

export type Decision = "approve" | "reject" | "request_changes" | "suspend";

export function decideProvider(providerId: string, decision: Decision, reason: string | null): boolean {
  const provider = store.providers.find((p) => p.id === providerId);
  if (!provider) return false;
  const t = now();
  const kindMap: Record<Decision, NotificationKind> = {
    approve: "provider_approved",
    reject: "provider_rejected",
    request_changes: "provider_changes_requested",
    suspend: "provider_suspended",
  };
  if (decision === "approve") {
    provider.verification_status = "approved";
  } else if (decision === "reject") {
    provider.verification_status = "rejected";
    provider.is_online = false;
  } else if (decision === "request_changes") {
    provider.verification_status = "changes_requested";
    provider.is_online = false;
  } else if (decision === "suspend") {
    provider.verification_status = "suspended";
    provider.is_online = false;
  }
  provider.review_note = decision === "approve" ? null : reason;
  provider.reviewed_at = t;
  const draft = getDraftByProvider(providerId);
  if (draft && decision === "request_changes") draft.status = "draft";
  store.audit.push({ id: uid(), provider_id: providerId, draft_id: draft?.id ?? null, decision, reason, at: t });
  notify(provider.owner_user_id, kindMap[decision], { reason: reason ?? "" });
  save();
  return true;
}

export function getOverview() {
  tick();
  const by = (k: ProviderKind) => store.providers.filter((p) => p.kind === k);
  const count = (list: MockProvider[], s: ProviderStatus) => list.filter((p) => p.verification_status === s).length;
  const riders = by("rider");
  const businesses = by("business");
  const today = new Date().toISOString().slice(0, 10);
  const todays = store.bookings.filter((b) => b.created_at.slice(0, 10) === today);
  return {
    pending: count(store.providers, "pending"),
    approved: count(store.providers, "approved"),
    active: store.providers.filter((p) => p.is_online && p.verification_status === "approved").length,
    bookings_today: todays.length,
    riders: { total: riders.length, pending: count(riders, "pending"), approved: count(riders, "approved") },
    businesses: { total: businesses.length, pending: count(businesses, "pending"), approved: count(businesses, "approved") },
    users: {
      total: store.users.length,
      customer: store.users.filter((u) => u.role === "customer").length,
      rider: store.users.filter((u) => u.role === "rider").length,
      business: store.users.filter((u) => u.role === "business").length,
    },
    revenue_today_xaf: todays.filter((b) => b.status === "completed").reduce((s, b) => s + (b.fare_final_xaf ?? 0), 0),
    completed_today: todays.filter((b) => b.status === "completed").length,
    rentals_open: store.rentalRequests.filter((r) => r.status === "requested").length,
    parcels_open: store.parcels.filter((p) => p.status !== "delivered" && p.status !== "cancelled").length,
  };
}

export type DayStat = {
  day: string;
  trips: number;
  completed: number;
  cancelled: number;
  revenue_xaf: number;
  rentals: number;
  parcels: number;
  signups: number;
  applications: number;
};

/** Daily figures for the admin trend charts (same shape as the admin_stats() RPC). */
export function getStats(days = 14): DayStat[] {
  tick();
  const n = Math.min(Math.max(Math.round(days) || 14, 1), 90);
  const out: DayStat[] = [];
  const dayOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const trips = store.bookings.filter((b) => dayOf(b.created_at) === day);
    const done = trips.filter((b) => b.status === "completed");
    out.push({
      day,
      trips: trips.length,
      completed: done.length,
      cancelled: trips.filter((b) => b.status === "cancelled" || b.status === "expired").length,
      revenue_xaf: done.reduce((sum, b) => sum + (b.fare_final_xaf ?? b.fare_estimate_xaf ?? 0), 0),
      rentals: store.rentalRequests.filter((r) => dayOf(r.created_at) === day).length,
      parcels: store.parcels.filter((x) => dayOf(x.created_at) === day).length,
      signups: store.users.filter((u) => dayOf(u.created_at) === day).length,
      applications: store.providers.filter((x) => dayOf(x.submitted_at) === day).length,
    });
  }
  return out;
}

export function getAuditLog(): AuditEntry[] {
  return store.audit;
}

// ---------------------------------------------------------------------------
// Rent
// ---------------------------------------------------------------------------

function isApproved(providerId: string) {
  return getProvider(providerId)?.verification_status === "approved";
}

/** Public rental catalogue: only available vehicles of approved businesses. */
export function getRentals(): RentalVehicle[] {
  return store.rentals.filter((v) => v.available && isApproved(v.provider_id));
}

export function getRentalVehicle(id: string): RentalVehicle | undefined {
  return store.rentals.find((v) => v.id === id);
}

export function getFleetForProvider(providerId: string): RentalVehicle[] {
  return store.rentals.filter((v) => v.provider_id === providerId);
}

export function addRentalVehicle(providerId: string, input: FleetInput, persistNow = true): RentalVehicle | null {
  const p = getProvider(providerId);
  if (!p || p.kind !== "business") return null;
  const v: RentalVehicle = {
    id: `rent-${uid().slice(0, 8)}`,
    provider_id: providerId,
    provider_name: p.display_name,
    type: input.type,
    brand: input.brand.trim(),
    model: input.model.trim(),
    plate: input.plate.trim().toUpperCase(),
    photo: input.photo ?? null,
    seats: input.seats ?? null,
    price_per_hour_xaf: Math.max(0, Math.round(input.price_per_hour_xaf || 0)),
    price_per_day_xaf: Math.max(0, Math.round(input.price_per_day_xaf || 0)),
    with_driver: !!input.with_driver,
    deposit_xaf: Math.max(0, Math.round(input.deposit_xaf || 0)),
    available: true,
  };
  store.rentals.push(v);
  if (!p.services.includes("rent")) p.services.push("rent");
  if (persistNow) save();
  return v;
}

export function updateRentalVehicle(id: string, providerId: string, patch: Partial<Pick<RentalVehicle, "available" | "price_per_day_xaf" | "price_per_hour_xaf" | "with_driver">>): RentalVehicle | null {
  const v = store.rentals.find((x) => x.id === id && x.provider_id === providerId);
  if (!v) return null;
  Object.assign(v, patch);
  save();
  return v;
}

export function removeRentalVehicle(id: string, providerId: string): boolean {
  const before = store.rentals.length;
  store.rentals = store.rentals.filter((x) => !(x.id === id && x.provider_id === providerId));
  save();
  return store.rentals.length < before;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 1;
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

export function createRentalRequest(input: {
  vehicle_id: string;
  customer_user_id?: string | null;
  customer_name: string;
  phone: string;
  start_date: string;
  end_date: string;
  with_driver: boolean;
}): RentalRequest | null {
  const vehicle = store.rentals.find((v) => v.id === input.vehicle_id);
  if (!vehicle || !vehicle.available || !isApproved(vehicle.provider_id)) return null;
  if (input.end_date < input.start_date) return null;
  const t = now();
  const req: RentalRequest = {
    id: uid(),
    vehicle_id: vehicle.id,
    vehicle_label: `${vehicle.brand} ${vehicle.model}`,
    provider_id: vehicle.provider_id,
    customer_user_id: input.customer_user_id ?? null,
    customer_name: input.customer_name,
    phone: input.phone,
    start_date: input.start_date,
    end_date: input.end_date,
    with_driver: input.with_driver,
    total_xaf: daysBetween(input.start_date, input.end_date) * vehicle.price_per_day_xaf,
    deposit_xaf: vehicle.deposit_xaf,
    status: "requested",
    created_at: t,
    updated_at: t,
  };
  store.rentalRequests.push(req);
  notify(getProvider(vehicle.provider_id)?.owner_user_id ?? null, "rental_requested", {
    vehicle: req.vehicle_label,
    customer: req.customer_name,
  });
  save();
  return req;
}

export function getRentalRequest(id: string): RentalRequest | undefined {
  tick();
  return store.rentalRequests.find((r) => r.id === id);
}

export function respondRental(id: string, confirm: boolean, providerId?: string): boolean {
  const req = store.rentalRequests.find((r) => r.id === id);
  if (!req || req.status !== "requested") return false;
  if (providerId && req.provider_id !== providerId) return false;
  req.status = confirm ? "confirmed" : "declined";
  req.updated_at = now();
  notify(req.customer_user_id, confirm ? "rental_confirmed" : "rental_declined", { vehicle: req.vehicle_label });
  save();
  return true;
}

export function setRentalStatus(id: string, providerId: string, status: "active" | "completed"): boolean {
  const req = store.rentalRequests.find((r) => r.id === id && r.provider_id === providerId);
  if (!req) return false;
  if (status === "active" && req.status !== "confirmed") return false;
  if (status === "completed" && req.status !== "active") return false;
  req.status = status;
  req.updated_at = now();
  if (status === "completed") {
    const p = getProvider(providerId);
    if (p) {
      p.trips_completed += 1;
      p.earnings_xaf += req.total_xaf;
    }
  }
  save();
  return true;
}

export function cancelRentalRequest(id: string, customerUserId: string): boolean {
  const req = store.rentalRequests.find((r) => r.id === id && r.customer_user_id === customerUserId);
  if (!req || (req.status !== "requested" && req.status !== "confirmed")) return false;
  req.status = "cancelled";
  req.updated_at = now();
  save();
  return true;
}

export function getRentalRequestsForProvider(providerId: string): RentalRequest[] {
  return store.rentalRequests.filter((r) => r.provider_id === providerId).slice().reverse();
}

export function getRentalRequestsForCustomer(userId: string): RentalRequest[] {
  tick();
  return store.rentalRequests.filter((r) => r.customer_user_id === userId).slice().reverse();
}

export function listAllRentalRequests(): RentalRequest[] {
  return store.rentalRequests.slice().reverse();
}

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------

export function parcelFare(size: ParcelSize, distanceM = 0): number {
  const base = size === "small" ? 500 : size === "medium" ? 1000 : 2000;
  const perKm = size === "large" ? 200 : 100;
  return Math.round((base + (distanceM / 1000) * perKm) / 25) * 25;
}

export function createParcel(input: {
  sender_user_id?: string | null;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  size: ParcelSize;
  notes?: string | null;
  photo: string | null;
}): ExpressParcel {
  const otp = String(Math.floor(1000 + Math.random() * 9000));
  const t = now();
  const parcel: ExpressParcel = {
    id: uid(),
    sender_user_id: input.sender_user_id ?? null,
    sender_name: input.sender_name,
    sender_phone: input.sender_phone,
    receiver_name: input.receiver_name,
    receiver_phone: input.receiver_phone,
    pickup: input.pickup,
    dropoff: input.dropoff,
    size: input.size,
    notes: input.notes ?? null,
    photo: input.photo,
    fare_xaf: parcelFare(input.size, haversineM(input.pickup, input.dropoff)),
    otp,
    status: "requested",
    provider_id: null,
    created_at: t,
    updated_at: t,
  };
  store.parcels.push(parcel);
  save();
  return parcel;
}

export function getParcel(id: string): ExpressParcel | undefined {
  tick();
  return store.parcels.find((p) => p.id === id);
}

function canDeliver(providerId: string): boolean {
  const p = getProvider(providerId);
  return !!p && p.verification_status === "approved" && p.services.includes("express");
}

export function acceptParcel(id: string, providerId: string): boolean {
  const parcel = store.parcels.find((p) => p.id === id);
  if (!parcel || parcel.status !== "requested") return false;
  if (!canDeliver(providerId)) return false;
  parcel.provider_id = providerId;
  parcel.status = "accepted";
  parcel.updated_at = now();
  notify(parcel.sender_user_id, "parcel_accepted", { provider: getProvider(providerId)?.display_name ?? "" });
  save();
  return true;
}

export function pickupParcel(id: string, providerId: string): boolean {
  const parcel = store.parcels.find((p) => p.id === id);
  if (!parcel || parcel.status !== "accepted" || parcel.provider_id !== providerId) return false;
  parcel.status = "in_transit";
  parcel.updated_at = now();
  save();
  return true;
}

export function deliverParcel(id: string, otp: string, providerId?: string): boolean {
  const parcel = store.parcels.find((p) => p.id === id);
  if (!parcel || parcel.status === "delivered" || parcel.status === "cancelled" || parcel.status === "requested") return false;
  if (providerId && parcel.provider_id !== providerId) return false;
  if (parcel.otp !== otp.trim()) return false;
  parcel.status = "delivered";
  parcel.updated_at = now();
  const p = parcel.provider_id ? getProvider(parcel.provider_id) : undefined;
  if (p) {
    p.trips_completed += 1;
    p.earnings_xaf += parcel.fare_xaf;
  }
  notify(parcel.sender_user_id, "parcel_delivered", { receiver: parcel.receiver_name });
  save();
  return true;
}

/** Open jobs + this provider's own deliveries. Only approved express providers see anything. */
export function getParcelsForProvider(providerId?: string): ExpressParcel[] {
  tick();
  if (!providerId || !canDeliver(providerId)) return [];
  return store.parcels.filter(
    (p) => p.status === "requested" || (p.provider_id === providerId && p.status !== "cancelled"),
  );
}

export function getParcelsForSender(userId: string): ExpressParcel[] {
  tick();
  return store.parcels.filter((p) => p.sender_user_id === userId).slice().reverse();
}

export function listAllParcels(): ExpressParcel[] {
  return store.parcels.slice().reverse();
}

// ---------------------------------------------------------------------------
// AI settings
// ---------------------------------------------------------------------------

export function getAISettings(): AISettings {
  return store.aiSettings;
}

export function updateAISettings(patch: Partial<AISettings>): AISettings {
  store.aiSettings = {
    ...store.aiSettings,
    ...patch,
    usage: store.aiSettings.usage,
  };
  save();
  return store.aiSettings;
}

export function logAIUsage(inputTokens: number, outputTokens: number) {
  store.aiSettings.usage.requests++;
  store.aiSettings.usage.input_tokens += inputTokens;
  store.aiSettings.usage.output_tokens += outputTokens;
  save();
}

// ---------------------------------------------------------------------------
// Admin-managed providers (demo equivalent of admin_create_provider / admin_update_provider)
// ---------------------------------------------------------------------------

export function adminCreateProvider(kind: ProviderKind, data: RegistrationData, approve: boolean): MockProvider | null {
  const draft = saveDraft(null, `admin-${uid()}`, 5, { ...data, kind });
  const p = submitDraft(draft.id);
  if (!p) return null;
  p.owner_user_id = null;
  if (approve) decideProvider(p.id, "approve", null);
  save();
  return p;
}

export function adminUpdateProvider(id: string, data: RegistrationData): MockProvider | null {
  const p = getProvider(id);
  const draft = getDraftByProvider(id);
  if (!p || !draft) return null;
  const keep = { status: p.verification_status, reviewed: p.reviewed_at, owner: p.owner_user_id, online: p.is_online };
  saveDraft(draft.id, draft.user_id, draft.step, { ...data, kind: p.kind, documents: draft.data.documents });
  submitDraft(draft.id);
  Object.assign(p, { verification_status: keep.status, reviewed_at: keep.reviewed, owner_user_id: keep.owner, is_online: keep.online });
  save();
  return p;
}
