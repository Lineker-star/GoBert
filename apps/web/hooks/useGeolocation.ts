"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type GeoState = {
  position: { lat: number; lng: number; accuracy: number } | null;
  status: "idle" | "locating" | "watching" | "denied" | "unavailable";
};

/** Live GPS via watchPosition. Starts only when `active` (or after start()) to respect privacy. */
export function useGeolocation(active = false) {
  const [state, setState] = useState<GeoState>({ position: null, status: "idle" });
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unavailable" }));
      return;
    }
    if (watchId.current != null) return;
    setState((s) => ({ ...s, status: s.position ? "watching" : "locating" }));
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setState({ position: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }, status: "watching" }),
      (err) => {
        stop();
        setState((s) => ({ ...s, status: err.code === err.PERMISSION_DENIED ? "denied" : "unavailable" }));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }, [stop]);

  useEffect(() => {
    if (active) start();
    return stop;
  }, [active, start, stop]);

  return { ...state, start, stop };
}
