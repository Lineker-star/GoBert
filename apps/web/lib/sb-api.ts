// Supabase implementation of the GoBert data API. Every call is an RPC defined in
// supabase/migrations/202611250001_*.sql — the database checks who is calling.
import { supabase } from "./supabase";
import { ApiError } from "./api-error";
import type {
  MockUser,
  MockProvider,
  PublicProvider,
  RegistrationDraft,
  RegistrationData,
  RentalVehicle,
  RentalRequest,
  ExpressParcel,
  MockNotification,
  MockBooking,
  FleetInput,
  UserRole,
  ParcelSize,
  ServiceKey,
  ProviderKind,
} from "./mock-store";

type RpcError = { message: string; details?: string | null; hint?: string | null; code?: string };

function toApiError(e: RpcError): ApiError {
  const msg = e.message ?? "error";
  if (e.hint === "incomplete" || msg === "incomplete") {
    return new ApiError(422, { error: "incomplete", missing: (e.details ?? "").split(",").filter(Boolean) });
  }
  if (/authentication required|sign in required|JWT/i.test(msg)) return new ApiError(401, { error: msg });
  if (/blocked|admin|forbidden|permission denied/i.test(msg)) return new ApiError(403, { error: msg });
  if (/unavailable/i.test(msg)) return new ApiError(409, { error: msg });
  return new ApiError(400, { error: msg });
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw toApiError(error as RpcError);
  return data as T;
}

// ---------------------------------------------------------------- accounts

export type Account = { user: MockUser; provider: MockProvider | null; draft: RegistrationDraft | null; fleet: RentalVehicle[] };

export async function getUser(): Promise<MockUser> {
  const u = await rpc<MockUser | null>("my_profile");
  if (!u) throw new ApiError(404, { error: "not found" });
  return u;
}

export async function getAccount(): Promise<Account> {
  const a = await rpc<Account | null>("my_account");
  if (!a) throw new ApiError(404, { error: "not found" });
  return a;
}

export const registerUser = (input: { role: UserRole; full_name: string; email?: string | null; city?: string; language?: "fr" | "en" }) =>
  rpc<MockUser>("register_profile", {
    p_account_type: input.role,
    p_full_name: input.full_name,
    p_email: input.email ?? null,
    p_city: input.city ?? "Bertoua",
    p_language: input.language ?? "fr",
  });

export const updateUser = (input: { full_name?: string; email?: string | null; city?: string; language?: "fr" | "en" }) =>
  rpc<MockUser>("update_profile", {
    p_full_name: input.full_name ?? null,
    p_email: input.email === undefined ? null : input.email ?? "",
    p_city: input.city ?? null,
    p_language: input.language ?? null,
  });

export const getNotifications = () => rpc<MockNotification[]>("my_notifications");
export const markNotificationsRead = async () => {
  await rpc("mark_notifications_read");
  return { ok: true };
};

export const createGuestTransfer = () => rpc<string | null>("create_guest_transfer");
export const redeemGuestTransfer = (code: string) => rpc<number>("redeem_guest_transfer", { p_code: code });

// ---------------------------------------------------------------- providers

export const getPublicProviders = (opts: { online?: boolean; service?: ServiceKey; kind?: ProviderKind } = {}) =>
  rpc<PublicProvider[]>("list_public_providers", { p_online: !!opts.online, p_service: opts.service ?? null, p_kind: opts.kind ?? null });

export async function getPublicProvider(id: string): Promise<PublicProvider> {
  const p = await rpc<PublicProvider | null>("get_public_provider", { p_id: id });
  if (!p) throw new ApiError(404, { error: "not found" });
  return p;
}

export type ProviderOffers = {
  provider: PublicProvider;
  fleet: RentalVehicle[];
  reviews: { stars: number; comment: string | null; at: string }[];
};
export const getProviderOffers = (id: string) => rpc<ProviderOffers | null>("provider_offers", { p_id: id });

export async function setOnline(_id: string, online: boolean, loc?: { lat: number; lng: number }): Promise<boolean> {
  try {
    return await rpc<boolean>("set_online", { p_online: online, p_lat: loc?.lat ?? null, p_lng: loc?.lng ?? null });
  } catch {
    return false;
  }
}

export const updateProviderSettings = (_id: string, _user: string, s: { accepts_direct_calls?: boolean; whatsapp?: string | null; bio?: string }) =>
  rpc<MockProvider>("update_provider_settings", {
    p_accepts_direct_calls: s.accepts_direct_calls ?? null,
    p_whatsapp: s.whatsapp ?? null,
    p_bio: s.bio ?? null,
  });

// ---------------------------------------------------------------- onboarding

/** Uploads a compressed photo to the private provider-docs bucket and returns its storage path. */
export async function uploadDocument(userId: string, type: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${userId}/${type}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("provider-docs").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: true });
  if (error) throw new ApiError(400, { error: error.message });
  return path;
}

/** Signed, short-lived URL to show a private document (owner or admin only — enforced by storage policies). */
export async function documentUrl(path: string): Promise<string | null> {
  if (path.startsWith("data:")) return path;
  const { data } = await supabase.storage.from("provider-docs").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

function stripPreviews(data: RegistrationData): RegistrationData {
  // Never ship image bytes into the database: only storage paths are kept.
  return {
    ...data,
    documents: data.documents?.map((d) => ({ ...d, data_url: d.storage_path ? "" : d.data_url })),
    vehicle_photo: undefined,
  };
}

export const saveRegistrationDraft = (_draftId: string | null, _userId: string, step: number, data: RegistrationData) =>
  rpc<RegistrationDraft>("save_application", { p_step: step, p_data: stripPreviews(data) });

export async function getRegistrationDraft(): Promise<RegistrationDraft | null> {
  try {
    return (await getAccount()).draft;
  } catch {
    return null;
  }
}

export const submitRegistration = () => rpc<MockProvider>("submit_application");

// ---------------------------------------------------------------- trips

export type CustomerBooking = MockBooking & { provider: PublicProvider | null; provider_phone: string | null };
export const getPassengerBookings = () => rpc<CustomerBooking[]>("my_trips");
export const getProviderBookings = () => rpc<MockBooking[]>("provider_trips");

// ---------------------------------------------------------------- rentals

export const getRentals = () => rpc<RentalVehicle[]>("list_rentals");
export const createRentalRequest = (i: { vehicle_id: string; customer_name: string; phone: string; start_date: string; end_date: string; with_driver: boolean }) =>
  rpc<RentalRequest>("create_rental_request", {
    p_vehicle: i.vehicle_id,
    p_name: i.customer_name,
    p_phone: i.phone,
    p_start: i.start_date,
    p_end: i.end_date,
    p_with_driver: i.with_driver,
  });
export async function getRentalRequest(id: string): Promise<RentalRequest> {
  const r = await rpc<RentalRequest | null>("get_rental_request", { p_id: id });
  if (!r) throw new ApiError(404, { error: "not found" });
  return r;
}
export const getCustomerRentals = () => rpc<RentalRequest[]>("my_rental_requests");
export const getProviderRentals = () => rpc<RentalRequest[]>("provider_rental_requests");
export const respondRental = async (id: string, confirm: boolean) => ({ ok: await rpc<boolean>("respond_rental", { p_id: id, p_confirm: confirm }) });
export const setRentalStatus = async (id: string, status: "active" | "completed" | "cancelled") =>
  ({ ok: await rpc<boolean>("set_rental_status", { p_id: id, p_status: status }) });

export const addFleetVehicle = (input: FleetInput) => rpc<RentalVehicle>("add_fleet_vehicle", { f: input });
export const updateFleetVehicle = (vehicleId: string, changes: Record<string, unknown>) =>
  rpc<RentalVehicle>("update_fleet_vehicle", { p_id: vehicleId, f: changes });
export const removeFleetVehicle = async (vehicleId: string) => ({ ok: await rpc<boolean>("remove_fleet_vehicle", { p_id: vehicleId }) });

// ---------------------------------------------------------------- express

export const createParcel = (input: {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  size: ParcelSize;
  notes?: string;
  photo: string | null;
}) => rpc<ExpressParcel>("create_parcel", { x: { ...input, photo: undefined } });
export async function getParcel(id: string): Promise<ExpressParcel> {
  const p = await rpc<ExpressParcel | null>("get_parcel", { p_id: id });
  if (!p) throw new ApiError(404, { error: "not found" });
  return p;
}
export const getSenderParcels = () => rpc<ExpressParcel[]>("my_parcels");
export const getProviderParcels = () => rpc<ExpressParcel[]>("provider_parcels");
export const acceptParcel = async (id: string) => ({ ok: await rpc<boolean>("accept_parcel", { p_id: id }) });
export const pickupParcel = async (id: string) => ({ ok: await rpc<boolean>("pickup_parcel", { p_id: id }) });
export const deliverParcel = async (id: string, otp: string) => ({ ok: await rpc<boolean>("deliver_parcel", { p_id: id, p_otp: otp }) });

// ---------------------------------------------------------------- dispatch

export const estimateTrip = (p: { lat: number; lng: number }, d: { lat: number; lng: number }, vtype: string, distanceM?: number) =>
  rpc<{ fare_estimate_xaf: number; distance_m: number; eta_min: number }>("estimate_trip", {
    p_plat: p.lat,
    p_plng: p.lng,
    p_dlat: d.lat,
    p_dlng: d.lng,
    p_vtype: vtype,
    p_distance_m: distanceM ? Math.round(distanceM) : null,
  });

export const createTrip = (i: {
  vehicle_type: string;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  payment_method: string;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  notes?: string;
  distance_m?: number;
}) =>
  rpc<CustomerBooking>("create_trip", {
    p_vtype: i.vehicle_type,
    p_pickup: i.pickup,
    p_dropoff: i.dropoff,
    p_payment: i.payment_method,
    p_passenger_name: i.passenger_name ?? null,
    p_passenger_phone: i.passenger_phone ?? null,
    p_notes: i.notes ?? null,
    p_distance_m: i.distance_m ? Math.round(i.distance_m) : null,
  });
export const getTrip = (id: string) => rpc<CustomerBooking | null>("get_trip", { p_id: id });
export const acceptTrip = (id: string) => rpc<boolean>("accept_trip", { p_id: id });
export const declineTrip = (id: string) => rpc<void>("decline_trip", { p_id: id });
export const setTripStatus = (id: string, status: string) => rpc<boolean>("set_trip_status", { p_id: id, p_status: status });
export const rateTrip = (id: string, stars: number, comment: string) => rpc<boolean>("rate_trip", { p_id: id, p_stars: stars, p_comment: comment });
export const incomingRequests = () => rpc<MockBooking[]>("incoming_requests");
