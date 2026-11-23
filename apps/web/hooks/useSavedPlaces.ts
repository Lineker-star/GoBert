"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase, type SavedPlace } from "@/lib/supabase";

const DEFAULT_PLACES: Omit<SavedPlace, "id">[] = [
  { label: "Home", lat: 4.5774, lng: 13.6846, address: "Bertoua centre" },
  { label: "Work", lat: 4.582, lng: 13.69, address: "Bertoua" },
  { label: "Market", lat: 4.57, lng: 13.68, address: "March\u00e9 central, Bertoua" },
  { label: "Hospital", lat: 4.585, lng: 13.675, address: "H\u00f4pital, Bertoua" },
  { label: "Carrefour", lat: 4.57, lng: 13.69, address: "Carrefour, Bertoua" },
];

function localKey(userId: string | null, anonToken: string | null) {
  if (userId) return `gobert:saved_places:user:${userId}`;
  return `gobert:saved_places:anon:${anonToken || "anonymous"}`;
}

export function useSavedPlaces(userId: string | null, anonToken: string | null) {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const key = localKey(userId, anonToken);
    try {
      if (userId && supabase) {
        const { data, error } = await supabase
          .from("saved_places")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true });
        if (!error && data) {
          setPlaces((data ?? []) as SavedPlace[]);
          setLoading(false);
          return;
        }
      }
    } catch {
      // fall through to localStorage
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setPlaces(JSON.parse(raw));
      } else {
        setPlaces(DEFAULT_PLACES.map((p) => ({ ...p, id: crypto.randomUUID() })));
      }
    } catch {
      setPlaces(DEFAULT_PLACES.map((p) => ({ ...p, id: crypto.randomUUID() })));
    } finally {
      setLoading(false);
    }
  }, [userId, anonToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (place: Omit<SavedPlace, "id">) => {
    const entry: SavedPlace = { ...place, id: crypto.randomUUID() };
    const next = [...places, entry];
    setPlaces(next);
    try {
      const key = localKey(userId, anonToken);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
    if (userId && supabase) {
      try {
        await supabase.from("saved_places").insert({ ...entry, user_id: userId });
      } catch {
        // ignore; localStorage already updated
      }
    }
    return entry;
  }, [places, userId, anonToken, supabase]);

  const remove = useCallback(async (id: string) => {
    const next = places.filter((p) => p.id !== id);
    setPlaces(next);
    try {
      const key = localKey(userId, anonToken);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
    if (userId && supabase) {
      try {
        await supabase.from("saved_places").delete().eq("id", id);
      } catch {
        // ignore
      }
    }
  }, [places, userId, anonToken]);

  return { places, loading, save, remove };
}
