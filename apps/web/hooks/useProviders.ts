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
      try {
        const res = await fetch("/api/mock/providers");
        const data = (await res.json()) as Provider[];
        setProviders(data);
        setError(null);
      } catch {
        setError("Failed to load providers");
      } finally {
        setLoading(false);
      }
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
