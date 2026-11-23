import { supabase } from "./supabase";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export type VehicleType = "moto" | "taxi" | "tricycle" | "truck" | "car_rental";
export type LatLng = { lat: number; lng: number };
export type LatLngLabel = LatLng & { label: string };

export type BookingStatus =
  | "requested"
  | "accepted"
  | "arriving"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";

export type MockVehicle = {
  type: VehicleType;
  brand: string;
  model: string;
  plate: string;
  color: string;
};

export type BookingProvider = {
  id: string;
  display_name: string;
  rating_avg: number;
  rating_count: number;
  vehicle: MockVehicle;
  photo: string;
  last_location: LatLng;
};

export type Booking = {
  id: string;
  passenger_id: string;
  provider_id: string | null;
  vehicle_type: VehicleType;
  pickup: LatLngLabel;
  dropoff: LatLngLabel;
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

export type Estimate = {
  fare_estimate_xaf: number;
  distance_m: number;
  eta_min: number;
};

export type DirectoryProvider = {
  id: string;
  display_name: string;
  rating_avg: number;
  rating_count: number;
  accepts_direct_calls: boolean;
  is_online: boolean;
  last_location: LatLng;
  service: string;
  vehicle: MockVehicle;
  photo: string;
};

async function mockFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function estimateFare(
  pickup: LatLng,
  dropoff: LatLng,
  vehicleType: VehicleType,
): Promise<Estimate> {
  if (USE_MOCKS) {
    return mockFetch<Estimate>("/api/mock/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pickup, dropoff, vehicle_type: vehicleType }),
    });
  }
  const { data, error } = await supabase.rpc("estimate_fare", {
    pickup: `SRID=4326;POINT(${pickup.lng} ${pickup.lat})`,
    dropoff: `SRID=4326;POINT(${dropoff.lng} ${dropoff.lat})`,
    vtype: vehicleType,
    city_id: null,
  });
  if (error) throw error;
  const fare = typeof data === "number" ? data : 0;
  return { fare_estimate_xaf: fare, distance_m: 0, eta_min: 0 };
}

export async function createBooking(input: {
  passenger_id: string;
  vehicle_type: VehicleType;
  pickup: LatLngLabel;
  dropoff: LatLngLabel;
}): Promise<Booking> {
  if (USE_MOCKS) {
    return mockFetch<Booking>("/api/mock/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  }
  const { data, error } = await supabase.rpc("create_booking", {
    p_passenger: input.passenger_id,
    p_anon: null,
    p_provider: null,
    p_service: null,
    p_vtype: input.vehicle_type,
    p_pickup: `SRID=4326;POINT(${input.pickup.lng} ${input.pickup.lat})`,
    p_pickup_label: input.pickup.label,
    p_dropoff: `SRID=4326;POINT(${input.dropoff.lng} ${input.dropoff.lat})`,
    p_dropoff_label: input.dropoff.label,
    p_fare: 0,
    p_payment: "cash",
    p_notes: null,
    p_phone_masked: null,
  });
  if (error) throw error;
  return { id: data as string } as Booking;
}

export async function getBooking(id: string): Promise<Booking | null> {
  if (USE_MOCKS) {
    return mockFetch<Booking>(`/api/mock/bookings?id=${id}`).catch(() => null);
  }
  const { data, error } = await supabase.from("bookings").select("*").eq("id", id).single();
  if (error) return null;
  return data as Booking;
}

export async function acceptBooking(bookingId: string, providerId: string): Promise<boolean> {
  if (USE_MOCKS) {
    const r = await mockFetch<{ won: boolean }>(`/api/mock/bookings/${bookingId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId }),
    });
    return r.won;
  }
  const { data, error } = await supabase.rpc("accept_booking", { booking_id: bookingId });
  if (error) return false;
  return !!data;
}

export async function declineBooking(bookingId: string, providerId: string): Promise<void> {
  if (USE_MOCKS) {
    await mockFetch(`/api/mock/bookings/${bookingId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId, decline: true }),
    });
    return;
  }
}

export async function setBookingStatus(bookingId: string, status: BookingStatus): Promise<boolean> {
  if (USE_MOCKS) {
    const r = await mockFetch<{ ok: boolean }>(`/api/mock/bookings/${bookingId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return r.ok;
  }
  const { data, error } = await supabase.rpc("set_booking_status", {
    booking_id: bookingId,
    new_status: status,
  });
  if (error) return false;
  return !!data;
}

export async function rateBooking(bookingId: string, stars: number, comment: string): Promise<boolean> {
  if (USE_MOCKS) {
    const r = await mockFetch<{ ok: boolean }>(`/api/mock/bookings/${bookingId}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars, comment }),
    });
    return r.ok;
  }
  const { error } = await supabase.from("ratings").insert({
    booking_id: bookingId,
    stars,
    comment,
  });
  return !error;
}

export async function setProviderOnline(
  id: string,
  isOnline: boolean,
  loc?: LatLng,
): Promise<void> {
  if (USE_MOCKS) {
    await mockFetch("/api/mock/providers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_online: isOnline, lat: loc?.lat, lng: loc?.lng }),
    });
    return;
  }
  await supabase
    .from("providers")
    .update({ is_online: isOnline, last_location: loc ? `SRID=4326;POINT(${loc.lng} ${loc.lat})` : undefined })
    .eq("id", id);
}

export async function getIncomingForProvider(providerId: string): Promise<Booking[]> {
  if (USE_MOCKS) {
    return mockFetch<Booking[]>(`/api/mock/providers/${providerId}/incoming`).catch(() => []);
  }
  return [];
}

export async function getDirectoryProviders(): Promise<DirectoryProvider[]> {
  if (USE_MOCKS) {
    const all = await mockFetch<DirectoryProvider[]>("/api/mock/providers");
    return all.filter((p) => p.is_online);
  }
  const { data } = await supabase.from("v_public_providers").select("*").eq("is_online", true);
  return (data ?? []) as DirectoryProvider[];
}

export async function getProvider(id: string): Promise<DirectoryProvider | null> {
  if (USE_MOCKS) {
    return mockFetch<DirectoryProvider>(`/api/mock/providers/${id}`).catch(() => null);
  }
  const { data } = await supabase
    .from("v_public_providers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as DirectoryProvider) ?? null;
}