import { queueRequest } from "./offline-queue";
import { request, getPublicProviders, getPublicProvider, USE_MOCKS } from "./api";
import * as sb from "./sb-api";
import type { MockBooking, PublicProvider, PaymentMethod, VehicleType as StoreVehicleType } from "./mock-store";

export { USE_MOCKS };
export type VehicleType = Exclude<StoreVehicleType, "car_rental">;
export type LatLng = { lat: number; lng: number };
export type LatLngLabel = LatLng & { label: string };
export type BookingStatus = MockBooking["status"];
export type { PaymentMethod };

export type DirectoryProvider = PublicProvider;
export type Booking = MockBooking & { provider?: PublicProvider | null; provider_phone?: string | null };
export type Estimate = { fare_estimate_xaf: number; distance_m: number; eta_min: number };

/** Fare estimate. Pass the road distance from the routing engine when known. */
export async function estimateFare(pickup: LatLng, dropoff: LatLng, vehicleType: VehicleType, roadDistanceM?: number): Promise<Estimate> {
  if (USE_MOCKS) {
    return request<Estimate>("/api/mock/estimate", { method: "POST", json: { pickup, dropoff, vehicle_type: vehicleType } });
  }
  return sb.estimateTrip(pickup, dropoff, vehicleType, roadDistanceM);
}

export type CreateBookingInput = {
  passenger_id: string;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  vehicle_type: VehicleType;
  pickup: LatLngLabel;
  dropoff: LatLngLabel;
  payment_method: PaymentMethod;
  notes?: string;
  distance_m?: number;
};

/** Creates a booking. Throws Error("queued") when offline (mock mode) — background sync sends it later. */
export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  if (!USE_MOCKS) return sb.createTrip(input);
  try {
    return await request<Booking>("/api/mock/bookings", { method: "POST", json: input });
  } catch (e) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueRequest({ url: "/api/mock/bookings", method: "POST", body: input });
      throw new Error("queued");
    }
    throw e;
  }
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (!USE_MOCKS) return sb.getTrip(id).catch(() => null);
  return request<Booking>(`/api/mock/bookings?id=${id}`).catch(() => null);
}

export async function acceptBooking(bookingId: string, providerId: string): Promise<boolean> {
  if (!USE_MOCKS) return sb.acceptTrip(bookingId).catch(() => false);
  const r = await request<{ won: boolean }>(`/api/mock/bookings/${bookingId}/accept`, { method: "POST", json: { provider_id: providerId } });
  return r.won;
}

export async function declineBooking(bookingId: string, providerId: string): Promise<void> {
  if (!USE_MOCKS) return void (await sb.declineTrip(bookingId).catch(() => undefined));
  await request(`/api/mock/bookings/${bookingId}/accept`, { method: "POST", json: { provider_id: providerId, decline: true } }).catch(() => undefined);
}

export async function setBookingStatus(bookingId: string, status: BookingStatus): Promise<boolean> {
  if (!USE_MOCKS) return sb.setTripStatus(bookingId, status).catch(() => false);
  const r = await request<{ ok: boolean }>(`/api/mock/bookings/${bookingId}/status`, { method: "POST", json: { status } }).catch(() => ({ ok: false }));
  return r.ok;
}

/** Throws ApiError(401) for guests — the UI asks them to sign in first. */
export async function rateBooking(bookingId: string, stars: number, comment: string): Promise<boolean> {
  if (!USE_MOCKS) return sb.rateTrip(bookingId, stars, comment);
  const r = await request<{ ok: boolean }>(`/api/mock/bookings/${bookingId}/rate`, { method: "POST", json: { stars, comment } }).catch(() => ({ ok: false }));
  return r.ok;
}

export async function getIncomingForProvider(providerId: string): Promise<Booking[]> {
  if (!USE_MOCKS) return sb.incomingRequests().catch(() => []);
  return request<Booking[]>(`/api/mock/providers/${providerId}/incoming`).catch(() => []);
}

export const getDirectoryProviders = (onlineOnly = false) => getPublicProviders({ online: onlineOnly });
export const getProvider = (id: string) => getPublicProvider(id).catch(() => null);
