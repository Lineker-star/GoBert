"use client";
import { useEffect } from "react";
import { flushOutbox, registerBackgroundSync } from "@/lib/offline-queue";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      registerBackgroundSync();
    }
    // flush queued bookings when connectivity returns
    const onOnline = () => {
      void flushOutbox();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  return null;
}