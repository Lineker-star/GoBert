// Shared in-memory mock store for the booking flow (server-side, used by API routes).
// Persists across requests in the Next.js server process via globalThis.

export type VehicleType = "moto" | "taxi" | "tricycle" | "truck" | "car_rental";

export type MockVehicle = {
  type: VehicleType;
  brand: string;
  model: string;
  plate: string;
  color: string;
};

export type MockProvider = {
  id: string;
  display_name: string;
  rating_avg: number;
  rating_count: number;
  accepts_direct_calls: boolean;
  is_online: boolean;
  last_location: { lat: number; lng: number };
  service: string;
  vehicle: MockVehicle;
  photo: string;
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
  provider_id: string | null;
  vehicle_type: VehicleType;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  fare_estimate_xaf: number;
  fare_final_xaf: number | null;
  distance_m: number;
  eta_min: number;
  payment_method: "cash";
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

type MockState = {
  providers: MockProvider[];
  bookings: MockBooking[];
};

const NAMES = [
  "Mbarga Jean","Nkoulou Marie","Tchoumi Paul","Etoa Bernard","Mballa Rose",
  "Nkeng Samuel","Tanyi Grace","Fouda Pierre","Manga Alice","Ngo Bell",
  "Tchinda Joseph","Ekema Sylvie","Nkolo David","Mbah Eric","Toche Clarisse",
  "Ngambe Serge","Etoundi Jeanne","Mballa II","Nkoulou Jean","Tchoumi Alain",
  "Etoa Marie","Mballa Paul","Nkeng Rose","Tanyi Bernard","Fouda Grace",
];
const TYPES: VehicleType[] = [
  "moto","moto","moto","moto","moto","moto","moto","moto","moto","moto",
  "moto","moto","moto","moto","moto","taxi","taxi","taxi","taxi","taxi","taxi",
  "taxi","taxi","truck","truck",
];
const VEHICLE_INFO: Record<VehicleType, { brand: string; model: string; color: string }> = {
  moto: { brand: "Sanota", model: "RX 135", color: "Rouge" },
  taxi: { brand: "Toyota", model: "Corolla", color: "Blanc" },
  tricycle: { brand: "Piaggio", model: "Ape", color: "Bleu" },
  truck: { brand: "Renault", model: "Master", color: "Gris" },
  car_rental: { brand: "Toyota", model: "Hilux", color: "Blanc" },
};

function buildProviders(): MockProvider[] {
  return NAMES.map((name, idx) => {
    const i = idx + 1;
    const type = TYPES[idx];
    const info = VEHICLE_INFO[type];
    return {
      id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      display_name: name,
      rating_avg: Math.round((4.2 + (i % 7) * 0.1) * 10) / 10,
      rating_count: 5 + i * 3,
      accepts_direct_calls: i % 2 === 0,
      is_online: true,
      last_location: {
        lat: 4.5774 + ((i % 7) - 3) * 0.006,
        lng: 13.6846 + ((i % 5) - 2) * 0.008,
      },
      service: type === "moto" ? "moto" : type === "taxi" ? "ride" : type === "truck" ? "cargo" : "ride",
      vehicle: {
        type,
        brand: info.brand,
        model: info.model,
        color: info.color,
        plate: `EST ${100 + i * 7} ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + ((i + 3) % 26))}`,
      },
      photo: `https://i.pravatar.cc/150?img=${(i % 60) + 1}`,
    };
  });
}

function initialState(): MockState {
  return { providers: buildProviders(), bookings: [] };
}

const g = globalThis as any;
if (!g.__GB_MOCK__) {
  g.__GB_MOCK__ = initialState();
}
const store = g.__GB_MOCK__ as MockState;

export function getProviders(): MockProvider[] {
  return store.providers;
}

export function getProvider(id: string): MockProvider | undefined {
  return store.providers.find((p) => p.id === id);
}

export function setProviderOnline(id: string, isOnline: boolean, loc?: { lat: number; lng: number }) {
  const p = store.providers.find((x) => x.id === id);
  if (!p) return;
  p.is_online = isOnline;
  if (loc) p.last_location = loc;
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

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
  const raw = rule.base + rule.perKm * km + rule.perMin * (distM / 500);
  const fare = Math.max(rule.min, Math.round(raw / 25) * 25);
  const etaMin = Math.max(2, Math.round(distM / 200)); // ~3.6 km/h city avg -> minutes
  return { fare_estimate_xaf: fare, distance_m: distM, eta_min: etaMin };
}

export function createBooking(input: {
  passenger_id: string;
  vehicle_type: VehicleType;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
}): MockBooking {
  const est = estimateFare(input.pickup, input.dropoff, input.vehicle_type);
  const now = new Date().toISOString();
  const booking: MockBooking = {
    id: crypto.randomUUID(),
    passenger_id: input.passenger_id,
    provider_id: null,
    vehicle_type: input.vehicle_type,
    pickup: input.pickup,
    dropoff: input.dropoff,
    fare_estimate_xaf: est.fare_estimate_xaf,
    fare_final_xaf: null,
    distance_m: est.distance_m,
    eta_min: est.eta_min,
    payment_method: "cash",
    status: "requested",
    created_at: now,
    updated_at: now,
    accepted_at: null,
    arrived_at: null,
    started_at: null,
    completed_at: null,
    rating: null,
    rating_comment: null,
  };
  store.bookings.push(booking);
  return booking;
}

export function getBooking(id: string): MockBooking | undefined {
  return store.bookings.find((b) => b.id === id);
}

// Single-winner accept: only one provider can win a requested booking.
export function acceptBooking(bookingId: string, providerId: string): boolean {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b) return false;
  if (b.status !== "requested") return false;
  const p = store.providers.find((x) => x.id === providerId);
  if (!p || !p.is_online) return false;
  b.provider_id = providerId;
  b.status = "accepted";
  b.accepted_at = new Date().toISOString();
  b.updated_at = b.accepted_at;
  return true;
}

export function declineBooking(bookingId: string, providerId: string): void {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (b && b.status === "requested") {
    b.updated_at = new Date().toISOString();
  }
}

export function setBookingStatus(bookingId: string, status: BookingStatus): boolean {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b) return false;
  const now = new Date().toISOString();
  if (status === "arriving" && b.status === "accepted") {
    b.status = "arriving";
    b.arrived_at = now;
  } else if (status === "in_progress" && (b.status === "arriving" || b.status === "accepted")) {
    b.status = "in_progress";
    b.started_at = now;
  } else if (status === "completed" && (b.status === "in_progress" || b.status === "arriving")) {
    b.status = "completed";
    b.completed_at = now;
    b.fare_final_xaf = b.fare_estimate_xaf;
  } else if (status === "cancelled" && ["requested", "accepted", "arriving"].includes(b.status)) {
    b.status = "cancelled";
  } else {
    return false;
  }
  b.updated_at = now;
  return true;
}

export function rateBooking(bookingId: string, stars: number, comment: string): boolean {
  const b = store.bookings.find((x) => x.id === bookingId);
  if (!b || b.status !== "completed") return false;
  b.rating = Math.max(1, Math.min(5, stars));
  b.rating_comment = comment || null;
  b.updated_at = new Date().toISOString();
  return true;
}

// Incoming requests for a provider: requested bookings within a radius.
export function getIncomingForProvider(providerId: string): MockBooking[] {
  const p = store.providers.find((x) => x.id === providerId);
  if (!p) return [];
  return store.bookings.filter((b) => {
    if (b.status !== "requested") return false;
    if (b.provider_id && b.provider_id !== providerId) return false;
    const dist = haversineM(p.last_location, b.pickup);
    return dist < 8000; // within 8km
  });
}