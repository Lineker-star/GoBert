"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { searchPlaces, type Place } from "@/lib/geocode";

export function useSearchPlaces(q: string, near: { lat: number; lng: number }, enabled = true) {
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string) => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const places = await searchPlaces(query, near, "fr");
      if (!ac.signal.aborted) setResults(places);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [near]);

  useEffect(() => {
    if (!enabled || !q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void search(q);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, near, enabled, search]);

  return { results, loading };
}
