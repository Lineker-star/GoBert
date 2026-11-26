"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useLocale, useTranslations } from "next-intl";
import {
  BadgeCheck,
  Banknote,
  CalendarDays,
  Flag,
  MapPin,
  Navigation,
  Package,
  Phone,
  Play,
  Power,
  Star,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAccount, usePolling } from "@/hooks/useAccount";
import { useIncomingRequests } from "@/hooks/useIncomingRequests";
import { useBooking } from "@/hooks/useBooking";
import { acceptBooking, declineBooking, setBookingStatus, type Booking } from "@/lib/booking-api";
import { acceptParcel, deliverParcel, getProviderBookings, getProviderParcels, pickupParcel, setOnline } from "@/lib/api";
import { formatDate, formatKm, formatXAF, whatsappLink } from "@/lib/format";
import { Alert, Badge, Button, Card, EmptyState, Input, PageLoader, RouteLine, STATUS_TONE, SectionTitle, Stat, cx } from "@/components/ui/primitives";
import { VEHICLE_ICON } from "@/components/ui/brand";
import { VerificationPanel } from "./VerificationPanel";
import type { ExpressParcel, MockProvider } from "@/lib/mock-store";

const REQUEST_TIMEOUT_S = 30;
const ACTIVE = ["accepted", "arriving", "in_progress"];

export default function RiderDashboard() {
  const t = useTranslations();
  const locale = useLocale();
  const { profile } = useAuth();
  const { account, loading, refresh } = useAccount(profile?.id, 15_000);
  const provider = account?.provider ?? null;

  if (loading && !account) return <PageLoader label={t("common.loading")} />;

  if (!provider) {
    const step = account?.draft?.step ?? 0;
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Header name={profile?.full_name} />
        <Card className="p-6">
          <p className="text-lg font-extrabold">{t("dashboard.rider.finishTitle")}</p>
          <p className="mt-1 text-sm text-charcoal/60">{t("dashboard.rider.finishHint")}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-grey">
            <div className="h-full bg-green" style={{ width: `${Math.max(8, ((step + 1) / 6) * 100)}%` }} />
          </div>
          <Button href={`/${locale}/onboard`} variant="accent" className="mt-5">
            {account?.draft ? t("dashboard.rider.continueOnboarding") : t("dashboard.rider.startOnboarding")}
          </Button>
        </Card>
      </div>
    );
  }

  if (provider.verification_status !== "approved") {
    const canEdit = provider.verification_status === "changes_requested" || provider.verification_status === "rejected";
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Header name={profile?.full_name} />
        <VerificationPanel provider={provider} onEdit={canEdit ? () => (window.location.href = `/${locale}/onboard`) : undefined} />
        <Card className="p-5">
          <p className="font-bold">{t("dashboard.rider.whileWaiting")}</p>
          <ul className="mt-3 space-y-2 text-sm text-charcoal/70">
            {[1, 2, 3].map((n) => (
              <li key={n} className="flex gap-2">
                <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0 text-green" />
                {t(`dashboard.rider.tip${n}`)}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return <ApprovedRider provider={provider} onChange={refresh} />;
}

function Header({ name }: { name?: string | null }) {
  const t = useTranslations();
  return (
    <div>
      <p className="text-sm text-charcoal/55">{t("roles.rider.label")}</p>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t("dashboard.hello", { name: name?.split(" ")[0] ?? "" })}</h1>
    </div>
  );
}

function ApprovedRider({ provider, onChange }: { provider: MockProvider; onChange: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const providerId = provider.id;
  const [isOnline, setIsOnline] = useState(provider.is_online);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lostRace, setLostRace] = useState(false);

  useEffect(() => {
    setIsOnline(provider.is_online);
  }, [provider.is_online]);

  // Stream the rider's GPS position while online (throttled) so customers can follow them live.
  const geo = useGeolocation(isOnline);
  const lastSent = useRef(0);
  useEffect(() => {
    const pos = geo.position;
    if (!isOnline || !pos || Date.now() - lastSent.current < 15_000) return;
    lastSent.current = Date.now();
    void setOnline(providerId, true, { lat: pos.lat, lng: pos.lng });
  }, [geo.position, isOnline, providerId]);

  const loadTrips = useCallback(() => getProviderBookings(providerId), [providerId]);
  const { value: trips, refresh: refreshTrips } = usePolling(loadTrips, 8_000, []);
  const offersExpress = provider.services.includes("express");
  const loadParcels = useCallback(() => getProviderParcels(providerId), [providerId]);
  const { value: parcels, refresh: refreshParcels } = usePolling(offersExpress ? loadParcels : null, 6_000, []);

  // Resume an ongoing trip after a reload.
  useEffect(() => {
    if (!currentId) {
      const ongoing = trips.find((b) => ACTIVE.includes(b.status));
      if (ongoing) setCurrentId(ongoing.id);
    }
  }, [trips, currentId]);

  const { incoming } = useIncomingRequests(providerId, isOnline && !currentId);
  const { booking: current } = useBooking(currentId);
  const request: Booking | null = incoming[0] ?? null;
  const requestId = request?.id ?? null;

  // Countdown per request; when it runs out the request is declined so it goes to the next rider.
  useEffect(() => {
    if (!requestId) {
      setCountdown(0);
      return;
    }
    let remaining = REQUEST_TIMEOUT_S;
    setCountdown(remaining);
    setLostRace(false);
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // vibration unsupported
    }
    const id = setInterval(() => {
      remaining -= 1;
      setCountdown(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(id);
        void declineBooking(requestId, providerId);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [requestId, providerId]);

  const toggleOnline = async () => {
    const next = !isOnline;
    setToggling(true);
    setToggleError(null);
    const loc = await new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
      if (!next || !navigator.geolocation) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(undefined),
        { timeout: 6000, maximumAge: 60_000 },
      );
    });
    const ok = await setOnline(providerId, next, loc);
    setToggling(false);
    if (!ok) return setToggleError(t("dashboard.rider.toggleFailed"));
    setIsOnline(next);
    onChange();
  };

  const accept = async () => {
    if (!request || busy) return;
    setBusy(true);
    const won = await acceptBooking(request.id, providerId).catch(() => false);
    setBusy(false);
    if (won) setCurrentId(request.id);
    else setLostRace(true);
  };

  const advance = async (status: "arriving" | "in_progress" | "completed") => {
    if (!currentId) return;
    setBusy(true);
    await setBookingStatus(currentId, status);
    setBusy(false);
    if (status === "completed") {
      setCurrentId(null);
      void refreshTrips();
      onChange();
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const done = trips.filter((b) => b.status === "completed");
    const todays = done.filter((b) => (b.completed_at ?? "").slice(0, 10) === today);
    return { todayEarnings: todays.reduce((s, b) => s + (b.fare_final_xaf ?? 0), 0), todayTrips: todays.length };
  }, [trips, today]);

  const VIcon = VEHICLE_ICON[provider.vehicle?.type ?? "moto"];

  return (
    <div className="space-y-6">
      {/* Online hero */}
      <div className={cx("relative overflow-hidden rounded-[1.75rem] p-6 text-white transition-colors", isOnline ? "bg-gradient-to-br from-green to-forest" : "bg-charcoal")}>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex-1 min-w-[14rem]">
            <div className="flex items-center gap-2 text-sm text-white/75">
              <VIcon className="w-4 h-4" />
              {provider.vehicle ? `${provider.vehicle.brand} ${provider.vehicle.model} · ${provider.vehicle.plate}` : ""}
              <Badge tone="green" className="!bg-white/15 !text-white">
                <BadgeCheck className="w-3.5 h-3.5" /> {t("status.approved")}
              </Badge>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-white">{isOnline ? t("dashboard.rider.youAreOnline") : t("dashboard.rider.youAreOffline")}</p>
            <p className="mt-1 text-sm text-white/70">{isOnline ? (currentId ? t("dashboard.rider.onTrip") : t("dashboard.rider.waiting")) : t("dashboard.rider.offlineHint")}</p>
          </div>
          <button
            onClick={toggleOnline}
            disabled={toggling || (!!currentId && isOnline)}
            className={cx(
              "relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full font-extrabold shadow-xl transition active:scale-95 disabled:opacity-60",
              isOnline ? "bg-white text-forest" : "bg-orange text-white",
            )}
            aria-pressed={isOnline}
          >
            {isOnline && <span className="absolute inset-0 rounded-full animate-pulse-ring" aria-hidden />}
            <Power className="w-7 h-7" />
            <span className="text-xs mt-1">{isOnline ? t("dashboard.rider.goOffline") : t("dashboard.rider.goOnline")}</span>
          </button>
        </div>
        {toggleError && <p className="mt-3 text-sm text-orange">{toggleError}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("dashboard.rider.stats.today")} value={formatXAF(stats.todayEarnings, locale)} icon={<Banknote className="w-5 h-5" />} />
        <Stat label={t("dashboard.rider.stats.tripsToday")} value={stats.todayTrips} icon={<TrendingUp className="w-5 h-5" />} tone="forest" />
        <Stat label={t("dashboard.rider.stats.rating")} value={provider.rating_count ? `${provider.rating_avg.toFixed(1)} ★` : "—"} icon={<Star className="w-5 h-5" />} tone="orange" />
        <Stat label={t("dashboard.rider.stats.total")} value={formatXAF(provider.earnings_xaf, locale)} icon={<CalendarDays className="w-5 h-5" />} />
      </div>

      {/* Current trip */}
      {current && ACTIVE.includes(current.status) && (
        <Card className="p-5 border-green/40">
          <div className="flex items-center justify-between">
            <SectionTitle className="!mb-0">{t("dashboard.rider.currentTrip")}</SectionTitle>
            <Badge tone={STATUS_TONE[current.status]}>{t(`booking.status.${current.status}`)}</Badge>
          </div>
          <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_auto]">
            <RouteLine from={current.pickup.label} to={current.dropoff.label} fromLabel={t("booking.pickup")} toLabel={t("booking.dropoff")} />
            <div className="sm:text-right">
              <p className="text-xs text-charcoal/50">{t(`payments.${current.payment_method}`)}</p>
              <p className="text-2xl font-extrabold text-green">{formatXAF(current.fare_estimate_xaf, locale)}</p>
              <p className="text-xs text-charcoal/50">{formatKm(current.distance_m, locale)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {current.passenger_phone && (
              <>
                <Button href={`tel:${current.passenger_phone}`} variant="outline" size="sm">
                  <Phone className="w-4 h-4" /> {t("common.call")}
                </Button>
                <Button href={whatsappLink(current.passenger_phone)} variant="outline" size="sm">
                  WhatsApp
                </Button>
              </>
            )}
            <Button
              href={`https://www.openstreetmap.org/directions?route=${current.pickup.lat}%2C${current.pickup.lng}%3B${current.dropoff.lat}%2C${current.dropoff.lng}`}
              variant="outline"
              size="sm"
            >
              <Navigation className="w-4 h-4" /> {t("dashboard.rider.navigate")}
            </Button>
          </div>
          <div className="mt-4">
            {current.status === "accepted" && (
              <Button block size="lg" onClick={() => advance("arriving")} loading={busy}>
                <MapPin className="w-5 h-5" /> {t("dashboard.rider.arrived")}
              </Button>
            )}
            {current.status === "arriving" && (
              <Button block size="lg" onClick={() => advance("in_progress")} loading={busy}>
                <Play className="w-5 h-5" /> {t("dashboard.rider.start")}
              </Button>
            )}
            {current.status === "in_progress" && (
              <Button block size="lg" variant="accent" onClick={() => advance("completed")} loading={busy}>
                <Flag className="w-5 h-5" />
                {current.payment_method === "cash" ? t("dashboard.rider.completeCash", { amount: formatXAF(current.fare_estimate_xaf, locale) }) : t("dashboard.rider.complete")}
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {offersExpress && <ExpressJobs providerId={providerId} parcels={parcels} onChange={refreshParcels} />}
        <section className={offersExpress ? "" : "lg:col-span-2"}>
          <SectionTitle>{t("dashboard.rider.recentTrips")}</SectionTitle>
          <Card>
            {trips.length === 0 ? (
              <EmptyState icon={<CalendarDays className="w-6 h-6" />} title={t("dashboard.rider.noTrips")} description={t("dashboard.rider.noTripsHint")} />
            ) : (
              <ul className="divide-y divide-grey/70">
                {trips.slice(0, 6).map((b) => (
                  <li key={b.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {b.pickup.label} → {b.dropoff.label}
                      </p>
                      <p className="text-xs text-charcoal/50">
                        {formatDate(b.created_at, locale, true)}
                        {b.rating ? ` · ${b.rating}★` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{formatXAF(b.fare_final_xaf ?? b.fare_estimate_xaf, locale)}</p>
                      <Badge tone={STATUS_TONE[b.status] ?? "grey"}>{t(`status.${b.status}`)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>

      {/* Incoming request sheet */}
      {request && countdown > 0 && !currentId && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-forest/50 backdrop-blur-[2px] p-0 sm:p-4" role="alertdialog" aria-label={t("dashboard.rider.newRequest")}>
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl animate-slide-in-bottom">
            <div className="flex items-center justify-between">
              <p className="text-lg font-extrabold">{t("dashboard.rider.newRequest")}</p>
              <span className="relative flex h-12 w-12 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
                  <circle cx="18" cy="18" r="16" fill="none" stroke="#E8ECE9" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="#F28C28"
                    strokeWidth="3"
                    strokeDasharray={100}
                    strokeDashoffset={100 - (countdown / REQUEST_TIMEOUT_S) * 100}
                    pathLength={100}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-sm font-extrabold text-orange">{countdown}</span>
              </span>
            </div>
            <div className="mt-4 rounded-2xl bg-ivory p-4">
              <RouteLine from={request.pickup.label} to={request.dropoff.label} fromLabel={t("booking.pickup")} toLabel={t("booking.dropoff")} />
            </div>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs text-charcoal/50">
                  {formatKm(request.distance_m, locale)} · {t(`payments.${request.payment_method}`)}
                </p>
                {request.notes && <p className="mt-1 text-xs text-charcoal/70">“{request.notes}”</p>}
              </div>
              <p className="text-3xl font-extrabold text-green">{formatXAF(request.fare_estimate_xaf, locale)}</p>
            </div>
            {lostRace && (
              <div className="mt-3">
                <Alert tone="orange">{t("dashboard.rider.lostRace")}</Alert>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" onClick={() => declineBooking(request.id, providerId)}>
                {t("dashboard.rider.decline")}
              </Button>
              <Button size="lg" onClick={accept} loading={busy}>
                {t("dashboard.rider.accept")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Delivery jobs for approved providers offering GoBert Express (riders and businesses). */
export function ExpressJobs({ providerId, parcels, onChange }: { providerId: string; parcels: ExpressParcel[]; onChange: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<{ ok: boolean }>, failMsg: string) => {
    setBusy(id);
    setError(null);
    const r = await fn().catch(() => ({ ok: false }));
    setBusy(null);
    if (!r.ok) setError(failMsg);
    onChange();
  };

  const open = parcels.filter((p) => p.status === "requested");
  const mine = parcels.filter((p) => p.provider_id === providerId && p.status !== "delivered");

  return (
    <section>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <Package className="w-5 h-5 text-orange" /> {t("dashboard.express.title")}
        </span>
      </SectionTitle>
      <Card>
        {error && (
          <div className="p-4 pb-0">
            <Alert tone="red">{error}</Alert>
          </div>
        )}
        {open.length + mine.length === 0 ? (
          <EmptyState icon={<Package className="w-6 h-6" />} title={t("dashboard.express.empty")} />
        ) : (
          <ul className="divide-y divide-grey/70">
            {[...mine, ...open].map((p) => (
              <li key={p.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">
                      {p.pickup.label} → {p.dropoff.label}
                    </p>
                    <p className="text-xs text-charcoal/55">
                      {t(`parcelSizes.${p.size}.name`)} · {p.receiver_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-green">{formatXAF(p.fare_xaf, locale)}</p>
                    <Badge tone={STATUS_TONE[p.status]}>{t(`status.${p.status}`)}</Badge>
                  </div>
                </div>
                {p.status === "requested" && (
                  <Button block size="sm" loading={busy === p.id} onClick={() => run(p.id, () => acceptParcel(p.id, providerId), t("dashboard.express.taken"))}>
                    {t("dashboard.express.accept")}
                  </Button>
                )}
                {p.status === "accepted" && p.provider_id === providerId && (
                  <div className="flex gap-2">
                    <Button href={`tel:${p.sender_phone}`} variant="outline" size="sm">
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button block size="sm" loading={busy === p.id} onClick={() => run(p.id, () => pickupParcel(p.id, providerId), t("common.error"))}>
                      {t("dashboard.express.pickedUp")}
                    </Button>
                  </div>
                )}
                {p.status === "in_transit" && p.provider_id === providerId && (
                  <div className="flex gap-2">
                    <Input
                      inputMode="numeric"
                      maxLength={4}
                      placeholder={t("dashboard.express.code")}
                      value={codes[p.id] ?? ""}
                      onChange={(e) => setCodes((c) => ({ ...c, [p.id]: e.target.value.replace(/\D/g, "") }))}
                      className="h-9 text-sm"
                    />
                    <Button
                      variant="accent"
                      size="sm"
                      loading={busy === p.id}
                      disabled={(codes[p.id] ?? "").length !== 4}
                      onClick={() => run(p.id, () => deliverParcel(p.id, providerId, codes[p.id] ?? ""), t("dashboard.express.wrongCode"))}
                    >
                      {t("dashboard.express.deliver")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
