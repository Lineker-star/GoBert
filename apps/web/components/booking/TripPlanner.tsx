"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Banknote, CircleCheck, Clock, MapPin, Navigation, Route as RouteIcon, Smartphone, Sparkles, Users } from "lucide-react";
import MapContainer from "@/components/map/MapContainer";
import PlaceField, { type PlacePoint } from "./PlaceField";
import { Alert, Button, Input, cx } from "@/components/ui/primitives";
import { ServiceIcon } from "@/components/ui/brand";
import { useAuth } from "@/lib/auth";
import { useProviders } from "@/hooks/useProviders";
import { useGeolocation } from "@/hooks/useGeolocation";
import { reverseGeocode } from "@/lib/geocode";
import { getRoute, type Route } from "@/lib/routing";
import { createBooking, estimateFare, type Estimate, type PaymentMethod } from "@/lib/booking-api";
import { RIDER_VEHICLES, type RiderVehicle } from "@/lib/domain";
import { BERTOUA_PLACES } from "@/lib/constants";
import { formatKm, formatXAF } from "@/lib/format";

const CENTER = { lat: 4.5774, lng: 13.6846 };
const VEHICLE_SERVICE: Record<RiderVehicle, string> = { moto: "moto", taxi: "ride", tricycle: "express", truck: "cargo" };
const PAYMENTS: { key: PaymentMethod; icon: React.ElementType }[] = [
  { key: "cash", icon: Banknote },
  { key: "mtn_momo", icon: Smartphone },
  { key: "orange_money", icon: Smartphone },
];

function shortLabel(full: string | null, fallback: string) {
  if (!full) return fallback;
  return full.split(",").slice(0, 2).join(",").trim();
}

/**
 * Uber-style trip planner: live GPS, tap/drag on the map or type to set pickup &
 * destination, real road route, price per vehicle, and booking — no account needed.
 */
export default function TripPlanner() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { session, profile, isAnonymous, signInAnonymous } = useAuth();
  const geo = useGeolocation(false);

  const [pickup, setPickup] = useState<PlacePoint | null>(null);
  const [dropoff, setDropoff] = useState<PlacePoint | null>(null);
  const [target, setTarget] = useState<"pickup" | "dropoff">("dropoff");
  const [vehicle, setVehicle] = useState<RiderVehicle>("moto");
  const [route, setRoute] = useState<Route | null>(null);
  const [estimates, setEstimates] = useState<Partial<Record<RiderVehicle, Estimate>>>({});
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsAsked, setGpsAsked] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const usedGpsForPickup = useRef(false);

  const { markers, providers } = useProviders();
  const service = VEHICLE_SERVICE[vehicle];
  const nearbyMarkers = useMemo(() => markers.filter((m) => m.service === service || providers.find((p) => p.id === m.id)?.vehicle?.type === vehicle), [markers, providers, service, vehicle]);
  const onlineCount = nearbyMarkers.length;

  // Pre-select vehicle from ?vehicle= / ?service=
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("vehicle") as RiderVehicle | null;
    if (v && RIDER_VEHICLES.includes(v)) setVehicle(v);
    else if (q.get("service") === "ride") setVehicle("taxi");
    else if (q.get("service") === "cargo") setVehicle("truck");
  }, []);

  // First GPS fix becomes the pickup (unless the user already chose one).
  useEffect(() => {
    const pos = geo.position;
    if (!pos || usedGpsForPickup.current) return;
    usedGpsForPickup.current = true;
    const point = { lat: pos.lat, lng: pos.lng, label: t("planner.myLocation") };
    setPickup((prev) => prev ?? point);
    reverseGeocode(pos.lat, pos.lng, locale).then((l) => l && setPickup((prev) => (prev && prev.lat === pos.lat ? { ...prev, label: shortLabel(l, prev.label) } : prev)));
  }, [geo.position, locale, t]);

  const useGps = () => {
    setGpsAsked(true);
    usedGpsForPickup.current = false;
    geo.start();
  };

  const setPoint = useCallback(
    (which: "pickup" | "dropoff", lat: number, lng: number) => {
      const point = { lat, lng, label: t("map.pinnedLocation") };
      (which === "pickup" ? setPickup : setDropoff)(point);
      reverseGeocode(lat, lng, locale).then((l) => {
        if (!l) return;
        (which === "pickup" ? setPickup : setDropoff)((prev) => (prev && prev.lat === lat && prev.lng === lng ? { ...prev, label: shortLabel(l, prev.label) } : prev));
      });
      if (which === "dropoff" && !pickup) setTarget("pickup");
      else if (which === "pickup" && !dropoff) setTarget("dropoff");
    },
    [locale, t, pickup, dropoff],
  );

  // Route + fares whenever both ends are known.
  useEffect(() => {
    setRoute(null);
    setEstimates({});
    if (!pickup || !dropoff) return;
    const ctrl = new AbortController();
    let refined = false;
    const fares = (distance?: number) =>
      Promise.all(RIDER_VEHICLES.map((v) => estimateFare(pickup, dropoff, v, distance).then((e) => [v, e] as const).catch(() => null))).then((list) => {
        const next: Partial<Record<RiderVehicle, Estimate>> = {};
        list.forEach((x) => x && (next[x[0]] = x[1]));
        return next;
      });
    // Show prices right away from the straight-line distance, then refine with the road route
    // (the public routing server can take several seconds on mobile networks).
    void fares().then((quick) => {
      if (!ctrl.signal.aborted && !refined) setEstimates(quick);
    });
    getRoute(pickup, dropoff, ctrl.signal).then((r) => {
      if (ctrl.signal.aborted) return;
      setRoute(r);
      if (!r.road) return; // straight-line fallback: the quick estimate already covers it
      void fares(r.distance_m).then((next) => {
        if (ctrl.signal.aborted || Object.keys(next).length === 0) return;
        refined = true;
        setEstimates(next);
      });
    });
    return () => ctrl.abort();
  }, [pickup, dropoff]);

  const swap = () => {
    setPickup(dropoff);
    setDropoff(pickup);
  };

  const book = async () => {
    if (!pickup || !dropoff) return;
    setBooking(true);
    setError(null);
    try {
      let passengerId = session?.user.id;
      if (!session) {
        const r = await signInAnonymous();
        if (r.error) throw new Error(r.error);
        passengerId = r.userId;
      }
      const est = estimates[vehicle];
      const b = await createBooking({
        passenger_id: passengerId ?? "anon",
        passenger_name: profile?.full_name ?? null,
        passenger_phone: profile?.phone || guestPhone.trim() || null,
        vehicle_type: vehicle,
        pickup,
        dropoff,
        payment_method: payment,
        notes: notes.trim() || undefined,
        distance_m: route?.distance_m ?? est?.distance_m,
      });
      router.push(`/${locale}/booking?id=${b.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg === "queued" ? t("booking.queued") : msg === "anonymous_disabled" ? t("auth.errors.anonymous_disabled") : t("common.networkError"));
      setBooking(false);
    }
  };

  const fitPoints = useMemo(() => [pickup, dropoff].filter(Boolean) as PlacePoint[], [pickup, dropoff]);
  const fitKey = fitPoints.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  const estimate = estimates[vehicle];
  const ready = !!pickup && !!dropoff;
  const near = pickup ?? geo.position ?? CENTER;

  return (
    <div className="relative h-full w-full overflow-hidden bg-grey">
      <MapContainer
        center={[CENTER.lng, CENTER.lat]}
        zoom={14}
        markers={nearbyMarkers}
        pickup={pickup}
        dropoff={dropoff}
        route={route?.coordinates ?? null}
        userLocation={geo.position}
        onMapClick={(lat, lng) => setPoint(target, lat, lng)}
        onPickupDragEnd={(lat, lng) => setPoint("pickup", lat, lng)}
        onDropoffDragEnd={(lat, lng) => setPoint("dropoff", lat, lng)}
        fitKey={fitKey || (geo.position ? `gps-${geo.position.lat.toFixed(3)}` : undefined)}
        fitPoints={fitPoints.length ? fitPoints : geo.position ? [geo.position] : []}
      />

      {/* Map-tap hint */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 lg:left-[calc(50%+210px)]">
        <span className="inline-flex items-center gap-2 rounded-full bg-forest/90 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur">
          <MapPin className={cx("w-4 h-4", target === "pickup" ? "text-green" : "text-orange")} />
          {target === "pickup" ? t("planner.tapPickup") : t("planner.tapDropoff")}
        </span>
      </div>

      {/* GPS button */}
      <button
        onClick={useGps}
        className="absolute right-3 top-16 lg:top-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white text-green shadow-lg"
        aria-label={t("geo.button")}
        title={t("geo.button")}
      >
        <Navigation className={cx("w-5 h-5", geo.status === "watching" && "fill-green")} />
      </button>

      {/* Panel: bottom sheet on mobile, floating card on desktop */}
      <section
        className={cx(
          "absolute z-20 bg-white shadow-[0_-12px_40px_rgba(18,61,50,0.18)] transition-all",
          "inset-x-0 bottom-0 rounded-t-[1.75rem] pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-5",
          "lg:inset-auto lg:left-4 lg:top-4 lg:bottom-4 lg:w-[420px] lg:rounded-[1.75rem] lg:shadow-2xl",
          sheetOpen ? "max-h-[68dvh] lg:max-h-none" : "max-h-[9.5rem]",
          "overflow-y-auto",
        )}
        aria-label={t("map.panel")}
      >
        <button className="sticky top-0 z-10 flex w-full justify-center bg-white pt-2 pb-1 lg:hidden" onClick={() => setSheetOpen((o) => !o)} aria-label={t("planner.toggleSheet")}>
          <span className="h-1.5 w-12 rounded-full bg-grey" />
        </button>
        <div className="space-y-4 px-4 pb-2 lg:px-5 lg:pt-5">
          <div className="flex items-end justify-between">
            <h1 className="text-2xl font-extrabold tracking-tight">{t("map.whereTo")}</h1>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-charcoal/55">
              <span className={cx("h-2 w-2 rounded-full", onlineCount ? "bg-green animate-pulse" : "bg-charcoal/30")} />
              {t("map.onlineCount", { count: onlineCount })}
            </span>
          </div>

          {/* Pickup / destination */}
          <div className="relative space-y-2">
            <PlaceField
              kind="pickup"
              value={pickup}
              onChange={setPickup}
              near={near}
              active={target === "pickup"}
              onFocus={() => setTarget("pickup")}
              onUseGps={useGps}
              gpsBusy={geo.status === "locating"}
              placeholder={t("planner.pickupPlaceholder")}
            />
            <PlaceField
              kind="dropoff"
              value={dropoff}
              onChange={setDropoff}
              near={near}
              active={target === "dropoff"}
              onFocus={() => setTarget("dropoff")}
              placeholder={t("search.placeholder")}
            />
            {ready && (
              <button onClick={swap} className="absolute right-14 top-[3.1rem] z-10 flex h-8 w-8 items-center justify-center rounded-full border border-grey bg-white text-charcoal/60 shadow-sm hover:text-green" aria-label={t("planner.swap")}>
                <ArrowUpDown className="w-4 h-4" />
              </button>
            )}
          </div>
          {(geo.status === "denied" || geo.status === "unavailable") && gpsAsked && <Alert tone="orange">{t("geo.denied")}</Alert>}

          {!ready && (
            <>
              <div className="flex flex-wrap gap-2">
                {BERTOUA_PLACES.slice(1, 7).map((p) => (
                  <button
                    key={p.key}
                    onClick={() => (target === "pickup" ? setPickup : setDropoff)({ lat: p.lat, lng: p.lng, label: p.label })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-grey bg-white px-3 h-9 text-sm font-semibold hover:border-green/50 hover:text-green"
                  >
                    <MapPin className="w-3.5 h-3.5 text-green" /> {p.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-charcoal/50">{t("planner.hint")}</p>
            </>
          )}

          {ready && (
            <>
              <div className="flex items-center gap-4 rounded-2xl bg-ivory px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <RouteIcon className="w-4 h-4 text-green" /> {route ? formatKm(route.distance_m, locale) : "…"}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Clock className="w-4 h-4 text-green" /> {route ? `~${Math.max(2, Math.round(route.duration_s / 60))} min` : "…"}
                </span>
                {route && !route.road && <span className="text-xs text-charcoal/45">{t("planner.approx")}</span>}
              </div>

              <div className="space-y-2" role="radiogroup" aria-label={t("booking.chooseVehicle")}>
                {RIDER_VEHICLES.map((v) => {
                  const e = estimates[v];
                  const on = vehicle === v;
                  return (
                    <button
                      key={v}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setVehicle(v)}
                      className={cx("flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition", on ? "border-green bg-green/5" : "border-grey bg-white hover:border-green/40")}
                    >
                      <span className={cx("flex h-12 w-12 items-center justify-center rounded-xl", on ? "bg-green text-white" : "bg-ivory text-charcoal/70")}>
                        <ServiceIcon service={v} className="w-6 h-6" />
                      </span>
                      <span className="flex-1">
                        <span className="block font-bold">{t(`vehicleTypes.${v}`)}</span>
                        <span className="block text-xs text-charcoal/55">{t(`booking.vehicleHint.${v}`)}</span>
                      </span>
                      <span className="text-right font-extrabold">{e ? formatXAF(e.fare_estimate_xaf, locale) : "…"}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("booking.payment")}>
                {PAYMENTS.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={payment === key}
                    onClick={() => setPayment(key)}
                    className={cx("relative flex h-12 items-center justify-center gap-1.5 rounded-xl border-2 text-xs font-bold", payment === key ? "border-green bg-green/5 text-green" : "border-grey text-charcoal/70")}
                  >
                    {payment === key && <CircleCheck className="absolute -right-1 -top-1 w-4 h-4 fill-white text-green" />}
                    <Icon className="w-4 h-4" /> {t(`payments.${key}`)}
                  </button>
                ))}
              </div>

              <Input value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))} placeholder={t("booking.notesPlaceholder")} />
              {(!profile || isAnonymous) && (
                <div>
                  <Input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder={t("booking.guestPhone")} />
                  <p className="mt-1 text-xs text-charcoal/50">{t("booking.guestPhoneHint")}</p>
                </div>
              )}
              {error && <Alert tone="red">{error}</Alert>}
              <Button block size="lg" variant="accent" onClick={book} loading={booking} disabled={!estimate}>
                {t("planner.book", { vehicle: t(`vehicleTypes.${vehicle}`), price: estimate ? formatXAF(estimate.fare_estimate_xaf, locale) : "…" })}
              </Button>
              {!session && (
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-charcoal/55">
                  <Sparkles className="w-3.5 h-3.5 text-green" /> {t("planner.noAccount")}
                </p>
              )}
            </>
          )}

          <Link href={`/${locale}/directory`} className="flex items-center gap-3 rounded-2xl bg-forest p-4 !text-white hover:bg-charcoal">
            <Users className="w-5 h-5 text-orange" />
            <span className="flex-1 text-sm font-semibold">{t("map.directoryCta")}</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
