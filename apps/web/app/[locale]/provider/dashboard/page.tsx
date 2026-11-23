"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Phone, CheckCircle2, Navigation, Play, Flag } from "lucide-react";
import { useIncomingRequests } from "@/hooks/useIncomingRequests";
import { useBooking } from "@/hooks/useBooking";
import {
  getProvider,
  setProviderOnline,
  acceptBooking,
  declineBooking,
  setBookingStatus,
  type DirectoryProvider,
  type Booking,
} from "@/lib/booking-api";

const DEFAULT_PROVIDER_ID = "00000000-0000-0000-0000-000000000001";
const REQUEST_TIMEOUT_S = 30;

export default function ProviderDashboard() {
  const t = useTranslations();

  const [providerId, setProviderId] = useState<string>(DEFAULT_PROVIDER_ID);
  const [provider, setProvider] = useState<DirectoryProvider | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pid = q.get("provider");
    if (pid) setProviderId(pid);
  }, []);

  useEffect(() => {
    getProvider(providerId).then((p) => {
      if (p) {
        setProvider(p);
        setIsOnline(p.is_online);
      }
    });
  }, [providerId]);

  const { incoming } = useIncomingRequests(providerId, isOnline && !currentId);
  const { booking: current } = useBooking(currentId);

  const incomingBooking: Booking | null = incoming.length > 0 ? incoming[0] : null;
  const incomingId = incomingBooking?.id ?? null;

  // countdown for the incoming request
  useEffect(() => {
    if (!incomingId) {
      setCountdown(0);
      return;
    }
    setCountdown(REQUEST_TIMEOUT_S);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [incomingId]);

  const toggleOnline = useCallback(async () => {
    const next = !isOnline;
    setIsOnline(next);
    const loc = provider?.last_location ?? { lat: 4.5774, lng: 13.6846 };
    await setProviderOnline(providerId, next, loc);
  }, [isOnline, provider, providerId]);

  const accept = useCallback(async () => {
    if (!incomingBooking || busy) return;
    setBusy(true);
    const won = await acceptBooking(incomingBooking.id, providerId);
    setBusy(false);
    if (won) {
      setCurrentId(incomingBooking.id);
    }
  }, [incomingBooking, providerId, busy]);

  const decline = useCallback(async () => {
    if (!incomingBooking) return;
    await declineBooking(incomingBooking.id, providerId);
  }, [incomingBooking, providerId]);

  const advance = useCallback(
    async (status: "arriving" | "in_progress" | "completed") => {
      if (!currentId) return;
      await setBookingStatus(currentId, status);
      if (status === "completed") {
        setCurrentId(null);
      }
    },
    [currentId],
  );

  const loc = provider?.last_location ?? { lat: 4.5774, lng: 13.6846 };

  return (
    <div className="min-h-screen bg-ivory p-4">
      <div className="max-w-sm mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-green">{t("provider.dashboard")}</h1>
              <p className="text-xs text-charcoal/50">{provider?.display_name ?? providerId.slice(-4)}</p>
            </div>
            <button
              onClick={toggleOnline}
              className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                isOnline ? "bg-green text-white" : "bg-grey text-charcoal"
              }`}
            >
              {isOnline ? t("provider.online") : t("provider.offline")}
            </button>
          </div>
          {provider && (
            <div className="mt-3 flex items-center gap-2 text-xs text-charcoal/50">
              <Navigation className="w-3 h-3" />
              <span>
                {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
              </span>
            </div>
          )}
        </div>

        {current ? (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider">
                {t("provider.currentTrip")}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green/10 text-green font-medium">
                {t(`booking.status.${current.status}`)}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green mt-1.5 shrink-0" />
                <div>
                  <div className="text-xs text-charcoal/50 uppercase">Départ</div>
                  <div className="text-sm font-medium text-charcoal">{current.pickup.label}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-orange mt-1.5 shrink-0" />
                <div>
                  <div className="text-xs text-charcoal/50 uppercase">Arrivée</div>
                  <div className="text-sm font-medium text-charcoal">{current.dropoff.label}</div>
                </div>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-charcoal/50 uppercase">{t("booking.fare")}</div>
                <div className="text-lg font-bold text-green">{current.fare_estimate_xaf.toLocaleString()} XAF</div>
              </div>
              <a href="tel:+237690000000" className="w-10 h-10 rounded-full bg-green/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-green" />
              </a>
            </div>
            <div className="flex flex-col gap-2">
              {current.status === "accepted" && (
                <button
                  onClick={() => advance("arriving")}
                  className="w-full bg-green text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  {t("provider.arrived")}
                </button>
              )}
              {current.status === "arriving" && (
                <button
                  onClick={() => advance("in_progress")}
                  className="w-full bg-green text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {t("provider.start")}
                </button>
              )}
              {current.status === "in_progress" && (
                <button
                  onClick={() => advance("completed")}
                  className="w-full bg-orange text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <Flag className="w-4 h-4" />
                  {t("provider.complete")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-5 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-charcoal/20 mb-2" />
            <p className="text-sm text-charcoal/40">{isOnline ? t("provider.waiting") : t("provider.offlineHint")}</p>
          </div>
        )}
      </div>

      {incomingBooking && countdown > 0 && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-green">{t("provider.newRequest")}</h2>
              <span className="text-sm font-bold text-orange">{countdown}s</span>
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green mt-1.5 shrink-0" />
                <div>
                  <div className="text-xs text-charcoal/50 uppercase">Départ</div>
                  <div className="text-sm font-medium text-charcoal">{incomingBooking.pickup.label}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-orange mt-1.5 shrink-0" />
                <div>
                  <div className="text-xs text-charcoal/50 uppercase">Arrivée</div>
                  <div className="text-sm font-medium text-charcoal">{incomingBooking.dropoff.label}</div>
                </div>
              </div>
            </div>
            <div className="text-right mb-4">
              <span className="text-lg font-bold text-green">{incomingBooking.fare_estimate_xaf.toLocaleString()} XAF</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={decline}
                className="flex-1 border border-grey rounded-xl py-2.5 text-sm font-medium text-charcoal"
              >
                {t("provider.decline")}
              </button>
              <button
                onClick={accept}
                disabled={busy}
                className="flex-1 bg-green text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                {t("provider.accept")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}