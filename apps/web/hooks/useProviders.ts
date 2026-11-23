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

const MOCK_NAMES = [
  "Mbarga Jean","Nkoulou Marie","Tchoumi Paul","Etoa Bernard","Mballa Rose",
  "Nkeng Samuel","Tanyi Grace","Fouda Pierre","Manga Alice","Ngo Bell",
  "Tchinda Joseph","Ekema Sylvie","Nkolo David","Mbah Eric","Toche Clarisse",
  "Ngambe Serge","Etoundi Jeanne","Mballa II","Nkoulou Jean","Tchoumi Alain",
  "Etoa Marie","Mballa Paul","Nkeng Rose","Tanyi Bernard","Fouda Grace",
];
const MOCK_TYPES = [
  "moto","moto","moto","moto","moto","moto","moto","moto","moto","moto",
  "moto","moto","moto","moto","moto","ride","ride","ride","ride","ride","ride",
  "ride","ride","cargo","cargo",
];
const MOCK_PROVIDERS: Provider[] = MOCK_NAMES.map((name, idx) => {
  const i = idx + 1;
  const service = MOCK_TYPES[idx];
  const online = i % 3 !== 0;
  return {
    id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    display_name: name,
    city_id: null,
    rating_avg: Math.round((4.2 + (i % 7) * 0.1) * 10) / 10,
    rating_count: 5 + i * 3,
    accepts_direct_calls: i % 2 === 0,
    is_online: online,
    last_location: {
      lat: 4.5774 + ((i % 7) - 3) * 0.006,
      lng: 13.6846 + ((i % 5) - 2) * 0.008,
    },
    last_seen_at: new Date().toISOString(),
    service,
  };
});

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
      setProviders(MOCK_PROVIDERS.filter((p) => p.is_online));
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
