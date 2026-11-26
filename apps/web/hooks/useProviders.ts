"use client";
import { useCallback, useEffect, useState } from "react";
import { getPublicProviders } from "@/lib/api";
import type { PublicProvider } from "@/lib/mock-store";

const SERVICE_COLOR: Record<string, string> = {
  moto: "#087C55",
  ride: "#123D32",
  express: "#F28C28",
  cargo: "#7c3aed",
  rent: "#6b7280",
  logistics: "#0e7490",
};

export type ProviderMarker = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  size: "sm" | "md";
  service?: string;
  kind?: "vehicle";
  vehicle?: string;
};

/** Approved providers that are online right now, refreshed every 10 s. */
export function useProviders(_center?: { lat: number; lng: number }) {
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      setProviders(await getPublicProviders({ online: true }));
      setError(null);
    } catch {
      setError("load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProviders();
    const id = setInterval(fetchProviders, 10_000);
    return () => clearInterval(id);
  }, [fetchProviders]);

  const markers: ProviderMarker[] = providers.map((p) => ({
    id: p.id,
    lat: p.last_location.lat,
    lng: p.last_location.lng,
    color: SERVICE_COLOR[p.service] ?? "#6b7280",
    label: p.display_name,
    size: "md",
    service: p.service,
    kind: "vehicle",
    vehicle: p.vehicle?.type ?? p.service,
  }));

  return { providers, markers, loading, error, retry: fetchProviders, count: providers.length };
}
