import type { RentalVehicle, RentalRequest, ExpressParcel, ParcelSize } from "./mock-store";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

async function mockFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export async function getRentals(): Promise<RentalVehicle[]> {
  return mockFetch<RentalVehicle[]>("/api/mock/rentals");
}

export async function createRentalRequest(input: {
  vehicle_id: string;
  customer_name: string;
  phone: string;
  start_date: string;
  end_date: string;
  with_driver: boolean;
}): Promise<RentalRequest> {
  return mockFetch<RentalRequest>("/api/mock/rentals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getRentalRequest(id: string): Promise<RentalRequest | null> {
  return mockFetch<RentalRequest>(`/api/mock/rentals/${id}`).catch(() => null);
}

export async function respondRental(id: string, confirm: boolean): Promise<boolean> {
  const r = await mockFetch<{ ok: boolean }>(`/api/mock/rentals/${id}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm }),
  });
  return r.ok;
}

export async function getRentalRequests(providerId: string): Promise<RentalRequest[]> {
  return mockFetch<RentalRequest[]>(`/api/mock/rental-requests?provider=${providerId}`);
}

export async function createParcel(input: {
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  pickup: { lat: number; lng: number; label: string };
  dropoff: { lat: number; lng: number; label: string };
  size: ParcelSize;
  photo: string | null;
}): Promise<ExpressParcel> {
  return mockFetch<ExpressParcel>("/api/mock/express", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getParcel(id: string): Promise<ExpressParcel | null> {
  return mockFetch<ExpressParcel>(`/api/mock/express/${id}`).catch(() => null);
}

export async function acceptParcel(id: string, providerId: string): Promise<boolean> {
  const r = await mockFetch<{ ok: boolean }>(`/api/mock/express/${id}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider_id: providerId }),
  });
  return r.ok;
}

export async function deliverParcel(id: string, otp: string): Promise<boolean> {
  const r = await mockFetch<{ ok: boolean }>(`/api/mock/express/${id}/deliver`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp }),
  });
  return r.ok;
}

export async function getParcels(): Promise<ExpressParcel[]> {
  return mockFetch<ExpressParcel[]>("/api/mock/express");
}