"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { getBooking, type Booking } from "@/lib/booking-api";

// Polls the booking row (mock) — in production this would be a Realtime subscription.
export function useBooking(bookingId: string | null) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setBooking(null);
      return;
    }
    let active = true;
    const poll = async () => {
      try {
        const b = await getBooking(bookingId);
        if (active && b) setBooking(b);
      } catch (e: any) {
        if (active) setError(e?.message ?? "error");
      }
    };
    setLoading(true);
    poll();
    timer.current = setInterval(poll, 1500);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [bookingId]);

  return { booking, loading, error };
}