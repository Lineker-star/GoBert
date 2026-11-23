"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getIncomingForProvider, type Booking } from "@/lib/booking-api";

export function useIncomingRequests(providerId: string | null, enabled: boolean) {
  const [incoming, setIncoming] = useState<Booking[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!providerId) return;
    try {
      const list = await getIncomingForProvider(providerId);
      setIncoming(list);
    } catch {
      // ignore
    }
  }, [providerId]);

  useEffect(() => {
    if (!providerId || !enabled) {
      setIncoming([]);
      return;
    }
    poll();
    timer.current = setInterval(poll, 2000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [providerId, enabled, poll]);

  return { incoming, refresh: poll };
}