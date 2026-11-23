"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { reverseGeocode } from "@/lib/geocode";

export function useReverseGeocode(lat: number | null, lng: number | null, enabled = true) {
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLabel = useCallback(async (la: number, lo: number) => {
    setLoading(true);
    try {
      const result = await reverseGeocode(la, lo);
      setLabel(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || lat == null || lng == null) {
      setLabel(null);
      setLoading(false);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void fetchLabel(lat, lng);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [lat, lng, enabled, fetchLabel]);

  return { label, loading };
}
