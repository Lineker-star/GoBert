"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, type Provider } from "@/lib/supabase";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const SERVICE_COLOR: Record<string, string> = {
  moto: "#087C55",
  ride: "#2563eb",
  express: "#F28C28",
  cargo: "#7c3aed",
  rent: "#6b7280",
};

const MOCK_PROVIDERS: Provider[] = [
  {
    id: "11111111-1111-1111-1111-111111111001",
    display_name: "Moto Rapide Bertoua",
    city_id: null,
    rating_avg: 4.8,
    rating_count: 32,
    accepts_direct_calls: true,
    is_online: true,
    last_location: { lat: 4.58, lng: 13.69 },
    last_seen_at: new Date().toISOString(),
    service: "moto",
  },
  {
    id: "11111111-1111-1111-1111-111111111002",
    display_name: "Taxi Sud Est",
    city_id: null,
    rating_avg: 4.6,
    rating_count: 21,
    accepts_direct_calls: false,
    is_online: true,
    last_location: { lat: 4.57, lng: 13.68 },
    last_seen_at: new Date().toISOString(),
    service: "ride",
  },
  {
    id: "11111111-1111-1111-1111-111111111003",
    display_name: "Cargo Express",
    city_id: null,
    rating_avg: 4.9,
    rating_count: 14,
    accepts_direct_calls: true,
    is_online: true,
    last_location: { lat: 4.575, lng: 13.678 },
    last_seen_at: new Date().toISOString(),
    service: "cargo",
  },
];

function markerFor(p: Provider) {
  const loc = p.last_location;
  if (!loc) return null;
  return {
    id: p.id,
    lat: loc.lat,
    lng: loc.lng,
    color: SERVICE_COLOR[p.service as keyof typeof SERVICE_COLOR] ?? "#6b7280",
    label: p.display_name,
    size: "md" as const,
    service: p.service,
  };
}

interface UseProvidersResult {
  providers: Provider[];
  markers: { id: string; lat: number; lng: number; color: string; label: string; size: "sm" | "md"; service?: string }[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  count: number;
}

export function useProviders(center: { lat: number; lng: number }): UseProvidersResult {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchProviders = useCallback(async () => {
    if (USE_MOCKS) {
      setProviders(MOCK_PROVIDERS);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("v_public_providers")
        .select("*")
        .eq("is_online", true);
      if (err) throw err;
      setProviders((data ?? []) as Provider[]);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProviders();
    timer.current = setInterval(() => {
      void fetchProviders();
    }, 10000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [fetchProviders]);

  const retry = useCallback(() => {
    void fetchProviders();
  }, [fetchProviders]);

  const markers = providers.map(markerFor).filter(Boolean) as {
    id: string; lat: number; lng: number; color: string; label: string; size: "sm" | "md";
  }[];

  return { providers, markers, loading, error, retry, count: providers.length };
}
