// GoBert data API used by the UI. In production it talks to Supabase (lib/sb-api.ts,
// where the database enforces who may do what). With NEXT_PUBLIC_USE_MOCKS=true it
// talks to the in-memory demo backend under /api/mock (local demos and tests only).
import * as sb from "./sb-api";
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

export { ApiError };
export const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const TIMEOUT_MS = 10_000;

export async function request<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: init?.json !== undefined ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data);
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

const post = <T>(url: string, json: unknown) => request<T>(url, { method: "POST", json });
const patch = <T>(url: string, json: unknown) => request<T>(url, { method: "PATCH", json });
const q = encodeURIComponent;

// ---------------------------------------------------------------- accounts

export type Account = sb.Account;
export type ProviderOffers = sb.ProviderOffers;
export type CustomerBooking = sb.CustomerBooking;

export const getUser = (id: string): Promise<MockUser> => (USE_MOCKS ? request<MockUser>(`/api/mock/users?id=${q(id)}`) : sb.getUser());
export const getAccount = (id: string): Promise<Account> => (USE_MOCKS ? request<Account>(`/api/mock/users/${q(id)}`) : sb.getAccount());

export const registerUser = (input: {
  id: string;
  phone: string;
  full_name: string;
  role: UserRole;
  email?: string | null;
  city?: string;
  language?: "fr" | "en";
}) => (USE_MOCKS ? post<MockUser>("/api/mock/users", input) : sb.registerUser(input));

export const updateUser = (input: { id: string; full_name?: string; email?: string | null; city?: string; language?: "fr" | "en" }) =>
  USE_MOCKS ? patch<MockUser>("/api/mock/users", input) : sb.updateUser(input);

export const getNotifications = (userId: string) =>
  USE_MOCKS ? request<MockNotification[]>(`/api/mock/notifications?user=${q(userId)}`) : sb.getNotifications();
export const markNotificationsRead = (userId: string) =>
  USE_MOCKS ? post<{ ok: boolean }>("/api/mock/notifications", { user: userId }) : sb.markNotificationsRead();

// ---------------------------------------------------------------- providers

export const getPublicProviders = (opts: { online?: boolean; service?: ServiceKey; kind?: ProviderKind } = {}) => {
  if (!USE_MOCKS) return sb.getPublicProviders(opts);
  const p = new URLSearchParams();
  if (opts.online) p.set("online", "1");
  if (opts.service) p.set("service", opts.service);
  if (opts.kind) p.set("kind", opts.kind);
  return request<PublicProvider[]>(`/api/mock/providers?${p.toString()}`);
};

export const getPublicProvider = (id: string) => (USE_MOCKS ? request<PublicProvider>(`/api/mock/providers/${id}`) : sb.getPublicProvider(id));

/** Offers, fleet and reviews of a provider — registered users only. */
export const getProviderOffers = (id: string) =>
  USE_MOCKS ? request<ProviderOffers>(`/api/mock/providers/${id}/offers`) : sb.getProviderOffers(id);

export async function setOnline(id: string, online: boolean, loc?: { lat: number; lng: number }): Promise<boolean> {
  if (!USE_MOCKS) return sb.setOnline(id, online, loc);
  try {
    await patch("/api/mock/providers", { id, is_online: online, lat: loc?.lat, lng: loc?.lng });
    return true;
  } catch {
    return false;
  }
}

export const updateProviderSettings = (id: string, user: string, settings: { accepts_direct_calls?: boolean; whatsapp?: string | null; bio?: string }) =>
  USE_MOCKS ? patch<MockProvider>(`/api/mock/providers/${id}`, { user, ...settings }) : sb.updateProviderSettings(id, user, settings);

// ---------------------------------------------------------------- onboarding

/** In Supabase mode documents go to private storage; mock mode keeps the inline preview. */
export async function uploadDocument(userId: string, type: string, dataUrl: string): Promise<string | undefined> {
  if (USE_MOCKS) return undefined;
  return sb.uploadDocument(userId, type, dataUrl);
}

export const documentUrl = (path: string) => (USE_MOCKS ? Promise.resolve(path) : sb.documentUrl(path));

export const saveRegistrationDraft = (draftId: string | null, userId: string, step: number, data: RegistrationData) =>
  USE_MOCKS
    ? post<RegistrationDraft>("/api/mock/registration", { draft_id: draftId, user_id: userId, step, data })
    : sb.saveRegistrationDraft(draftId, userId, step, data);

export async function getRegistrationDraft(userId: string): Promise<RegistrationDraft | null> {
  if (!USE_MOCKS) return sb.getRegistrationDraft();
  try {
    return await request<RegistrationDraft>(`/api/mock/registration?user=${q(userId)}`);
  } catch {
    return null;
  }
}

export const submitRegistration = (draftId: string) =>
  USE_MOCKS ? post<MockProvider>("/api/mock/registration/submit", { draft_id: draftId }) : sb.submitRegistration();

// ---------------------------------------------------------------- trips

export const getPassengerBookings = (userId: string) =>
  USE_MOCKS ? request<CustomerBooking[]>(`/api/mock/bookings?passenger=${q(userId)}`) : sb.getPassengerBookings();
export const getProviderBookings = (providerId: string) =>
  USE_MOCKS ? request<MockBooking[]>(`/api/mock/bookings?provider=${q(providerId)}`) : sb.getProviderBookings();

// ---------------------------------------------------------------- rentals

export const getRentals = () => (USE_MOCKS ? request<RentalVehicle[]>("/api/mock/rentals") : sb.getRentals());
export const createRentalRequest = (input: {
  vehicle_id: string;
  customer_user_id: string | null;
  customer_name: string;
  phone: string;
  start_date: string;
  end_date: string;
  with_driver: boolean;
}) => (USE_MOCKS ? post<RentalRequest>("/api/mock/rentals", input) : sb.createRentalRequest(input));
export const getRentalRequest = (id: string) => (USE_MOCKS ? request<RentalRequest>(`/api/mock/rentals/${id}`) : sb.getRentalRequest(id));
export const getCustomerRentals = (userId: string) =>
  USE_MOCKS ? request<RentalRequest[]>(`/api/mock/rental-requests?customer=${q(userId)}`) : sb.getCustomerRentals();
export const getProviderRentals = (providerId: string) =>
  USE_MOCKS ? request<RentalRequest[]>(`/api/mock/rental-requests?provider=${q(providerId)}`) : sb.getProviderRentals();
export const respondRental = (id: string, confirm: boolean, providerId: string) =>
  USE_MOCKS ? post<{ ok: boolean }>(`/api/mock/rentals/${id}/respond`, { confirm, provider_id: providerId }) : sb.respondRental(id, confirm);
export const setRentalStatus = (id: string, providerId: string, status: "active" | "completed") =>
  USE_MOCKS ? post<{ ok: boolean }>(`/api/mock/rentals/${id}/status`, { provider_id: providerId, status }) : sb.setRentalStatus(id, status);
export const cancelRental = (id: string, userId: string) =>
  USE_MOCKS ? post<{ ok: boolean }>(`/api/mock/rentals/${id}/status`, { user_id: userId, status: "cancelled" }) : sb.setRentalStatus(id, "cancelled");

export const addFleetVehicle = (providerId: string, user: string, input: FleetInput) =>
  USE_MOCKS ? post<RentalVehicle>(`/api/mock/providers/${providerId}/fleet`, { ...input, user }) : sb.addFleetVehicle(input);
export const updateFleetVehicle = (
  providerId: string,
  user: string,
  vehicleId: string,
  changes: { available?: boolean; price_per_day_xaf?: number; price_per_hour_xaf?: number; with_driver?: boolean },
) =>
  USE_MOCKS
    ? patch<RentalVehicle>(`/api/mock/providers/${providerId}/fleet`, { user, vehicle_id: vehicleId, ...changes })
    : sb.updateFleetVehicle(vehicleId, changes);
export const removeFleetVehicle = (providerId: string, user: string, vehicleId: string) =>
  USE_MOCKS
    ? request<{ ok: boolean }>(`/api/mock/providers/${providerId}/fleet?user=${q(user)}&vehicle=${q(vehicleId)}`, { method: "DELETE" })
    : sb.removeFleetVehicle(vehicleId);

// ---------------------------------------------------------------- express

export const createParcel = (input: {
  sender_user_id: string | null;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  size: ParcelSize;
  notes?: string;
  photo: string | null;
}) => (USE_MOCKS ? post<ExpressParcel>("/api/mock/express", input) : sb.createParcel(input));
export const getParcel = (id: string, userId?: string | null) =>
  USE_MOCKS ? request<ExpressParcel>(`/api/mock/express/${id}${userId ? `?user=${q(userId)}` : ""}`) : sb.getParcel(id);
export const getSenderParcels = (userId: string) =>
  USE_MOCKS ? request<ExpressParcel[]>(`/api/mock/express?sender=${q(userId)}`) : sb.getSenderParcels();
export const getProviderParcels = (providerId: string) =>
  USE_MOCKS ? request<ExpressParcel[]>(`/api/mock/express?provider=${q(providerId)}`) : sb.getProviderParcels();
export const acceptParcel = (id: string, providerId: string) =>
  USE_MOCKS ? post<{ ok: boolean }>(`/api/mock/express/${id}/accept`, { provider_id: providerId }) : sb.acceptParcel(id);
export const pickupParcel = (id: string, providerId: string) =>
  USE_MOCKS ? post<{ ok: boolean }>(`/api/mock/express/${id}/pickup`, { provider_id: providerId }) : sb.pickupParcel(id);
export const deliverParcel = (id: string, providerId: string, otp: string) =>
  USE_MOCKS ? post<{ ok: boolean }>(`/api/mock/express/${id}/deliver`, { provider_id: providerId, otp }) : sb.deliverParcel(id, otp);
