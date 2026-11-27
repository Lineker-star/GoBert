"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, CircleCheck, MessageCircle, Phone, Share2, Smartphone, Star, X } from "lucide-react";
import MapContainer from "@/components/map/MapContainer";
import { Alert, Avatar, Badge, Button, Card, Input, PageLoader, RouteLine, STATUS_TONE, Textarea, cx } from "@/components/ui/primitives";
import { ServiceIcon } from "@/components/ui/brand";
import { useAuth } from "@/lib/auth";
import { useBooking } from "@/hooks/useBooking";
import {
  createBooking,
  estimateFare,
  rateBooking,
  setBookingStatus,
  type Estimate,
  type LatLngLabel,
  type PaymentMethod,
} from "@/lib/booking-api";
import { RIDER_VEHICLES, type RiderVehicle } from "@/lib/domain";
import { BERTOUA } from "@/lib/supabase";
import { formatKm, formatXAF, whatsappLink } from "@/lib/format";
import { getRoute } from "@/lib/routing";
import { ApiError } from "@/lib/api";

const PAYMENTS: { key: PaymentMethod; icon: React.ElementType; tone: string }[] = [
  { key: "cash", icon: Banknote, tone: "bg-green/10 text-green" },
  { key: "mtn_momo", icon: Smartphone, tone: "bg-[#FFCB05]/25 text-[#7A6100]" },
  { key: "orange_money", icon: Smartphone, tone: "bg-orange/15 text-[#B25E0B]" },
];
const TRACK_STEPS = ["accepted", "arriving", "in_progress", "completed"] as const;

export default function BookingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { session, user, profile, isAnonymous, signInAnonymous, loading: authLoading } = useAuth();

  const [ready, setReady] = useState(false);
  const [pickup, setPickup] = useState<LatLngLabel>({ ...BERTOUA, label: "Bertoua Centre" });
  const [dropoff, setDropoff] = useState<LatLngLabel | null>(null);
  const [vehicle, setVehicle] = useState<RiderVehicle>("moto");
  const [estimates, setEstimates] = useState<Partial<Record<RiderVehicle, Estimate>>>({});
  const [estimating, setEstimating] = useState(false);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [rated, setRated] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);

  // Read params once: either resume (?id=) or a new trip (?lat&lng&label&plat&plng&plabel&vehicle).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("id");
    if (id) setBookingId(id);
    const lat = parseFloat(q.get("lat") ?? "");
    const lng = parseFloat(q.get("lng") ?? "");
    if (Number.isFinite(lat) && Number.isFinite(lng)) setDropoff({ lat, lng, label: q.get("label") || t("booking.destination") });
    const plat = parseFloat(q.get("plat") ?? "");
    const plng = parseFloat(q.get("plng") ?? "");
    if (Number.isFinite(plat) && Number.isFinite(plng)) setPickup({ lat: plat, lng: plng, label: q.get("plabel") || "Bertoua" });
    const v = q.get("vehicle") as RiderVehicle | null;
    if (v && RIDER_VEHICLES.includes(v)) setVehicle(v);
    setReady(true);
  }, [t]);

  // Fare for every vehicle type so the rider can compare.
  useEffect(() => {
    if (!dropoff || bookingId) return;
    let alive = true;
    setEstimating(true);
    Promise.all(RIDER_VEHICLES.map((v) => estimateFare(pickup, dropoff, v).then((e) => [v, e] as const).catch(() => null)))
      .then((list) => {
        if (!alive) return;
        const next: Partial<Record<RiderVehicle, Estimate>> = {};
        list.forEach((x) => x && (next[x[0]] = x[1]));
        setEstimates(next);
      })
      .finally(() => alive && setEstimating(false));
    return () => {
      alive = false;
    };
  }, [pickup, dropoff, bookingId]);

  const { booking } = useBooking(bookingId);
  const estimate = estimates[vehicle];

  const confirm = useCallback(async () => {
    if (!dropoff) return;
    setCreating(true);
    setCreateError(null);
    try {
      let passengerId = user?.id;
      if (!session) {
        // Anonymous booking is allowed: create a guest session on the fly.
        const res = await signInAnonymous();
        if (res.error) throw new Error(res.error);
        passengerId = res.userId;
      }
      const b = await createBooking({
        passenger_id: passengerId ?? "anon",
        passenger_name: profile?.full_name ?? null,
        passenger_phone: profile?.phone ?? (guestPhone.trim() ? guestPhone.trim() : null),
        vehicle_type: vehicle,
        pickup,
        dropoff,
        payment_method: payment,
        notes: notes.trim() || undefined,
      });
      setBookingId(b.id);
      router.replace(`/${locale}/booking?id=${b.id}`);
    } catch (e) {
      setCreateError(e instanceof Error && e.message === "queued" ? t("booking.queued") : e instanceof Error && e.message === "captcha_failed" ? t("auth.errors.captcha_failed") : t("common.networkError"));
    } finally {
      setCreating(false);
    }
  }, [dropoff, user, session, signInAnonymous, profile, guestPhone, vehicle, pickup, payment, notes, router, locale, t]);

  const cancel = async () => {
    if (!bookingId) return;
    setCancelling(true);
    await setBookingStatus(bookingId, "cancelled");
    setCancelling(false);
  };

  const rebook = () => {
    if (!booking) return;
    const q = new URLSearchParams({
      lat: String(booking.dropoff.lat),
      lng: String(booking.dropoff.lng),
      label: booking.dropoff.label,
      plat: String(booking.pickup.lat),
      plng: String(booking.pickup.lng),
      plabel: booking.pickup.label,
      vehicle: booking.vehicle_type,
    });
    setBookingId(null);
    setDropoff(booking.dropoff);
    setPickup(booking.pickup);
    router.replace(`/${locale}/booking?${q.toString()}`);
  };

  const submitRating = async () => {
    if (!bookingId || !stars) return;
    try {
      const ok = await rateBooking(bookingId, stars, comment);
      if (ok) setRated(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setNeedsSignIn(true);
    }
  };

  // Live rider position (polled with the booking) and the route they are driving.
  const riderLoc = booking?.provider && ["accepted", "arriving", "in_progress"].includes(booking.status) ? booking.provider.last_location : null;
  const markers = useMemo(() => {
    const p = booking?.provider;
    if (!p || !riderLoc) return [];
    return [{ id: p.id, lat: riderLoc.lat, lng: riderLoc.lng, color: "#123D32", label: p.display_name, size: "md" as const, kind: "vehicle" as const, vehicle: booking?.vehicle_type }];
  }, [booking?.provider, booking?.vehicle_type, riderLoc]);

  const legFrom = booking?.status === "in_progress" ? booking.pickup : riderLoc ?? booking?.pickup ?? pickup;
  const legTo = booking && booking.status !== "in_progress" && riderLoc ? booking.pickup : booking?.dropoff ?? dropoff;
  const legKey = legFrom && legTo ? `${legFrom.lat.toFixed(4)},${legFrom.lng.toFixed(4)},${legTo.lat.toFixed(4)},${legTo.lng.toFixed(4)}` : "";
  useEffect(() => {
    if (!legFrom || !legTo) return;
    let alive = true;
    getRoute(legFrom, legTo).then((r) => alive && setRoute(r.coordinates));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legKey]);

  if (!ready || authLoading || (bookingId && !booking)) return <PageLoader label={t("common.loading")} />;

  const back = (
    <Link
      href={`/${locale}${bookingId ? "/trips" : ""}`}
      className="absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-charcoal shadow-lg"
      aria-label={t("common.back")}
    >
      <ArrowLeft className="w-5 h-5" />
    </Link>
  );

  if (!bookingId && !dropoff) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-bold">{t("booking.pickFirst")}</p>
        <Button href={`/${locale}`}>{t("map.whereTo")}</Button>
      </div>
    );
  }

  const pickupPoint = booking?.pickup ?? pickup;
  const mapCenter: [number, number] = [(booking?.dropoff ?? dropoff!).lng, (booking?.dropoff ?? dropoff!).lat];

  return (
    <div className="min-h-dvh bg-ivory lg:grid lg:grid-cols-[1fr_440px]">
      <div className="relative h-[38dvh] lg:h-dvh lg:sticky lg:top-0">
        <MapContainer
          center={mapCenter}
          zoom={13}
          markers={markers}
          pickup={{ lat: pickupPoint.lat, lng: pickupPoint.lng }}
          dropoff={booking?.dropoff ?? dropoff}
          route={route}
          fitKey={`${booking?.status ?? "new"}-${legKey}`}
          fitPoints={[pickupPoint, booking?.dropoff ?? dropoff, riderLoc].filter(Boolean) as { lat: number; lng: number }[]}
        />
        {back}
      </div>

      <div className="relative -mt-6 lg:mt-0 rounded-t-[1.75rem] lg:rounded-none bg-white p-5 pb-10 shadow-[0_-12px_40px_rgba(18,61,50,0.12)] lg:shadow-none lg:border-l lg:border-grey min-h-[62dvh] lg:min-h-dvh">
        {/* --------------------------------------------------- review */}
        {!booking && dropoff && (
          <div className="space-y-5 animate-fade-in">
            <h1 className="text-xl font-extrabold">{t("booking.reviewTitle")}</h1>
            <Card className="p-4">
              <RouteLine from={pickup.label} to={dropoff.label} fromLabel={t("booking.pickup")} toLabel={t("booking.dropoff")} />
            </Card>

            <div>
              <p className="mb-2 text-sm font-bold">{t("booking.chooseVehicle")}</p>
              <div className="space-y-2" role="radiogroup">
                {RIDER_VEHICLES.map((v) => {
                  const e = estimates[v];
                  const active = vehicle === v;
                  return (
                    <button
                      key={v}
                      role="radio"
                      aria-checked={active}
                      onClick={() => setVehicle(v)}
                      className={cx(
                        "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition",
                        active ? "border-green bg-green/5" : "border-grey bg-white hover:border-green/40",
                      )}
                    >
                      <span className={cx("flex h-12 w-12 items-center justify-center rounded-xl", active ? "bg-green text-white" : "bg-ivory text-charcoal/70")}>
                        <ServiceIcon service={v} className="w-6 h-6" />
                      </span>
                      <span className="flex-1">
                        <span className="block font-bold">{t(`vehicleTypes.${v}`)}</span>
                        <span className="block text-xs text-charcoal/55">{t(`booking.vehicleHint.${v}`)}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-extrabold">{e ? formatXAF(e.fare_estimate_xaf, locale) : estimating ? "…" : "—"}</span>
                        {e && <span className="block text-xs text-charcoal/50">~{e.eta_min} min</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold">{t("booking.payment")}</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {PAYMENTS.map(({ key, icon: Icon, tone }) => (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={payment === key}
                    onClick={() => setPayment(key)}
                    className={cx(
                      "relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-xs font-bold transition",
                      payment === key ? "border-green bg-green/5" : "border-grey bg-white hover:border-green/40",
                    )}
                  >
                    {payment === key && <CircleCheck className="absolute right-1.5 top-1.5 w-4 h-4 text-green" />}
                    <span className={cx("flex h-9 w-9 items-center justify-center rounded-full", tone)}>
                      <Icon className="w-5 h-5" />
                    </span>
                    {t(`payments.${key}`)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-charcoal/50">{t(`booking.paymentHint.${payment}`)}</p>
            </div>

            <Textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))} placeholder={t("booking.notesPlaceholder")} className="min-h-[64px]" />

            {(!profile || isAnonymous) && (
              <div>
                <p className="mb-1 text-sm font-bold">{t("booking.guestPhone")}</p>
                <Input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="+237 6…" />
                <p className="mt-1 text-xs text-charcoal/50">{t("booking.guestPhoneHint")}</p>
              </div>
            )}

            {estimate && (
              <div className="flex items-center justify-between rounded-2xl bg-ivory p-4">
                <div>
                  <p className="text-xs text-charcoal/55">{t("booking.total")}</p>
                  <p className="text-xs text-charcoal/45">{formatKm(estimate.distance_m, locale)}</p>
                </div>
                <p className="text-2xl font-extrabold text-green">{formatXAF(estimate.fare_estimate_xaf, locale)}</p>
              </div>
            )}
            {createError && <Alert tone="orange">{createError}</Alert>}
            <Button block size="lg" variant="accent" onClick={confirm} loading={creating} disabled={!estimate}>
              {t("booking.confirm", { vehicle: t(`vehicleTypes.${vehicle}`) })}
            </Button>
          </div>
        )}

        {/* --------------------------------------------------- searching */}
        {booking?.status === "requested" && (
          <div className="flex flex-col items-center py-8 text-center animate-fade-in">
            <div className="relative h-28 w-28">
              <span className="absolute inset-0 rounded-full bg-green/15 animate-ping" />
              <span className="absolute inset-3 rounded-full bg-green/20 animate-ping [animation-delay:300ms]" />
              <span className="absolute inset-6 flex items-center justify-center rounded-full bg-green text-white shadow-lg">
                <ServiceIcon service={booking.vehicle_type} className="w-7 h-7" />
              </span>
            </div>
            <h1 className="mt-6 text-xl font-extrabold">{t("booking.looking")}</h1>
            <p className="mt-1 max-w-xs text-sm text-charcoal/55">{t("booking.lookingHint")}</p>
            <Card className="mt-6 w-full p-4 text-left">
              <RouteLine from={booking.pickup.label} to={booking.dropoff.label} fromLabel={t("booking.pickup")} toLabel={t("booking.dropoff")} />
              <div className="mt-3 flex justify-between border-t border-grey pt-3 text-sm">
                <span className="text-charcoal/55">{t(`payments.${booking.payment_method}`)}</span>
                <span className="font-extrabold">{formatXAF(booking.fare_estimate_xaf, locale)}</span>
              </div>
            </Card>
            <Button variant="outline" className="mt-5" onClick={cancel} loading={cancelling}>
              <X className="w-4 h-4" /> {t("booking.cancel")}
            </Button>
          </div>
        )}

        {/* --------------------------------------------------- tracking */}
        {booking && ["accepted", "arriving", "in_progress"].includes(booking.status) && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-extrabold">{t(`booking.statusTitle.${booking.status}`)}</h1>
              <Badge tone={STATUS_TONE[booking.status]}>{t(`booking.status.${booking.status}`)}</Badge>
            </div>
            <Stepper current={booking.status} />
            {booking.provider && (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={booking.provider.display_name} src={booking.provider.photo} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold truncate">{booking.provider.display_name}</p>
                    {booking.provider.vehicle && (
                      <p className="text-sm text-charcoal/60 truncate">
                        {booking.provider.vehicle.brand} {booking.provider.vehicle.model} · {booking.provider.vehicle.color}
                      </p>
                    )}
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-orange">
                      <Star className="w-3.5 h-3.5 fill-orange" /> {booking.provider.rating_avg.toFixed(1)}
                      <span className="font-normal text-charcoal/45">({booking.provider.rating_count})</span>
                    </p>
                  </div>
                  {booking.provider.vehicle && (
                    <span className="rounded-lg border-2 border-charcoal bg-[#FFE36E] px-2 py-1 font-mono text-xs font-extrabold tracking-wider">{booking.provider.vehicle.plate}</span>
                  )}
                </div>
                {booking.provider_phone && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button href={`tel:${booking.provider_phone}`} variant="soft">
                      <Phone className="w-4 h-4" /> {t("common.call")}
                    </Button>
                    <Button href={whatsappLink(booking.provider_phone)} variant="soft">
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </Button>
                  </div>
                )}
              </Card>
            )}
            <Card className="p-4">
              <RouteLine from={booking.pickup.label} to={booking.dropoff.label} fromLabel={t("booking.pickup")} toLabel={t("booking.dropoff")} />
              <div className="mt-3 flex justify-between border-t border-grey pt-3 text-sm">
                <span className="text-charcoal/55">{t(`payments.${booking.payment_method}`)}</span>
                <span className="font-extrabold text-green">{formatXAF(booking.fare_estimate_xaf, locale)}</span>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                href={`https://wa.me/?text=${encodeURIComponent(
                  t("booking.shareText", {
                    from: booking.pickup.label,
                    to: booking.dropoff.label,
                    name: booking.provider?.display_name ?? "",
                    plate: booking.provider?.vehicle?.plate ?? "",
                  }),
                )}`}
              >
                <Share2 className="w-4 h-4" /> {t("booking.shareTrip")}
              </Button>
              {booking.status !== "in_progress" ? (
                <Button variant="danger" onClick={cancel} loading={cancelling}>
                  {t("booking.cancel")}
                </Button>
              ) : (
                <Button variant="outline" href="tel:117">
                  SOS 117
                </Button>
              )}
            </div>
          </div>
        )}

        {/* --------------------------------------------------- completed */}
        {booking?.status === "completed" && (
          <div className="flex flex-col items-center text-center py-4 animate-fade-in">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green text-white shadow-lg shadow-green/30">
              <CircleCheck className="w-9 h-9" />
            </span>
            <h1 className="mt-4 text-2xl font-extrabold">{t("booking.completed")}</h1>
            <p className="mt-1 text-sm text-charcoal/55">{t(`booking.paidWith.${booking.payment_method}`)}</p>
            <p className="mt-3 text-4xl font-extrabold text-green">{formatXAF(booking.fare_final_xaf ?? booking.fare_estimate_xaf, locale)}</p>
            {!rated && !booking.rating && (isAnonymous || !profile || needsSignIn) ? (
              <Card className="mt-6 w-full p-5">
                <p className="font-bold">{t("booking.rate", { name: booking.provider?.display_name ?? "" })}</p>
                <div className="my-3 flex justify-center gap-1 opacity-40" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="w-8 h-8 text-grey" />
                  ))}
                </div>
                <p className="text-sm text-charcoal/60">{t("booking.signInToRate")}</p>
                <Button href={`/${locale}/auth?next=${encodeURIComponent(`/${locale}/booking?id=${booking.id}`)}`} block className="mt-3">
                  {t("booking.signInToRateCta")}
                </Button>
              </Card>
            ) : !rated && !booking.rating ? (
              <Card className="mt-6 w-full p-5">
                <p className="font-bold">{t("booking.rate", { name: booking.provider?.display_name ?? "" })}</p>
                <div className="my-3 flex justify-center gap-1" role="radiogroup" aria-label={t("booking.rate", { name: "" })}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setStars(n)} aria-label={`${n}/5`} role="radio" aria-checked={stars === n} className="p-1">
                      <Star className={cx("w-9 h-9 transition", n <= stars ? "fill-orange text-orange scale-110" : "text-grey")} />
                    </button>
                  ))}
                </div>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("booking.comment")} className="min-h-[64px]" />
                <Button block className="mt-3" onClick={submitRating} disabled={!stars}>
                  {t("booking.submitRating")}
                </Button>
              </Card>
            ) : (
              <Alert tone="green">{t("booking.thanks")}</Alert>
            )}
            <div className="mt-6 grid w-full grid-cols-2 gap-2">
              <Button variant="outline" onClick={rebook}>
                {t("booking.bookAgain")}
              </Button>
              <Button href={`/${locale}/dashboard`}>{t("nav.home")}</Button>
            </div>
          </div>
        )}

        {/* --------------------------------------------------- cancelled / expired */}
        {booking && (booking.status === "cancelled" || booking.status === "expired") && (
          <div className="flex flex-col items-center py-10 text-center animate-fade-in">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-charcoal/5 text-charcoal/50">
              <X className="w-8 h-8" />
            </span>
            <h1 className="mt-4 text-xl font-extrabold">{t(`booking.${booking.status}Title`)}</h1>
            <p className="mt-1 max-w-xs text-sm text-charcoal/55">{t(`booking.${booking.status}Hint`)}</p>
            <div className="mt-6 flex gap-2">
              <Button variant="accent" onClick={rebook}>
                {t("booking.tryAgain")}
              </Button>
              <Button variant="outline" href={`/${locale}/directory`}>
                {t("nav.directory")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ current }: { current: string }) {
  const t = useTranslations();
  const idx = TRACK_STEPS.indexOf(current as (typeof TRACK_STEPS)[number]);
  return (
    <ol className="flex items-center gap-1.5">
      {TRACK_STEPS.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1.5">
          <span className={cx("h-1.5 rounded-full transition-colors", i <= idx ? "bg-green" : "bg-grey")} />
          <span className={cx("text-[11px] font-semibold", i <= idx ? "text-green" : "text-charcoal/40")}>{t(`booking.status.${s}`)}</span>
        </li>
      ))}
    </ol>
  );
}
