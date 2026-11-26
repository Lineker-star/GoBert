import { NextRequest } from "next/server";
import {
  createBooking,
  getBooking,
  getProvider,
  toPublicProvider,
  listBookingsForPassenger,
  listBookingsForProvider,
  type MockBooking,
  type PaymentMethod,
  type VehicleType,
} from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

const VEHICLES: VehicleType[] = ["moto", "taxi", "tricycle", "truck"];
const PAYMENTS: PaymentMethod[] = ["cash", "mtn_momo", "orange_money"];
const REVEALED = ["accepted", "arriving", "in_progress", "completed"];

type Point = { lat: number; lng: number; label?: string };
const validPoint = (p: Point | undefined): p is Point => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/** Customer view: the provider's phone is only revealed once they accepted the trip. */
function forCustomer(b: MockBooking) {
  const p = b.provider_id ? getProvider(b.provider_id) : undefined;
  const revealed = !!p && REVEALED.includes(b.status);
  return {
    ...b,
    provider: p ? toPublicProvider(p) : null,
    provider_phone: revealed ? p!.phone : null,
  };
}

export async function POST(req: NextRequest) {
  const b = await body<{
    passenger_id?: string;
    vehicle_type?: VehicleType;
    pickup?: Point;
    dropoff?: Point;
    payment_method?: PaymentMethod;
    passenger_name?: string;
    passenger_phone?: string;
    notes?: string;
  }>(req);
  if (!b.vehicle_type || !VEHICLES.includes(b.vehicle_type)) return bad("invalid vehicle_type");
  if (!validPoint(b.pickup) || !validPoint(b.dropoff)) return bad("invalid pickup or dropoff");
  const booking = createBooking({
    passenger_id: b.passenger_id ?? "anon",
    vehicle_type: b.vehicle_type,
    pickup: { lat: b.pickup.lat, lng: b.pickup.lng, label: String(b.pickup.label ?? "") },
    dropoff: { lat: b.dropoff.lat, lng: b.dropoff.lng, label: String(b.dropoff.label ?? "") },
    payment_method: b.payment_method && PAYMENTS.includes(b.payment_method) ? b.payment_method : "cash",
    passenger_name: b.passenger_name ?? null,
    passenger_phone: b.passenger_phone ?? null,
    notes: b.notes?.slice(0, 300) ?? null,
  });
  return json(forCustomer(booking));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");
  const passenger = sp.get("passenger");
  const provider = sp.get("provider");
  if (id) {
    const booking = getBooking(id);
    if (!booking) return bad("not found", 404);
    return json(forCustomer(booking));
  }
  if (passenger) return json(listBookingsForPassenger(passenger).map(forCustomer));
  if (provider) return json(listBookingsForProvider(provider));
  return bad("missing id, passenger or provider");
}
