"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Bike, Car, Truck, Phone, X, Star, CheckCircle2, Loader2 } from "lucide-react";
import MapContainer from "@/components/map/MapContainer";
import { useBooking } from "@/hooks/useBooking";
import {
  estimateFare,
  createBooking,
  setBookingStatus,
  rateBooking,
  getProvider,
  type VehicleType,
  type Estimate,
  type Booking,
  type DirectoryProvider,
} from "@/lib/booking-api";
import { BERTOUA } from "@/lib/supabase";

type Step = "choose" | "looking" | "accepted" | "completed";

const VEHICLES: { type: VehicleType; Icon: React.ElementType }[] = [
  { type: "moto", Icon: Bike },
  { type: "taxi", Icon: Car },
  { type: "tricycle", Icon: Car },
  { type: "truck", Icon: Truck },
];

const STATUS_STEPS = ["accepted", "arriving", "in_progress", "completed"] as const;

function BookingFlowInner() {
  const t = useTranslations();
  const router = useRouter();

  const [dropoff, setDropoff] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [vehicle, setVehicle] = useState<VehicleType>("moto");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [provider, setProvider] = useState<DirectoryProvider | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [ratingDone, setRatingDone] = useState(false);

  const { booking } = useBooking(bookingId);

  // read destination from query string
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const lat = parseFloat(q.get("lat") ?? "");
    const lng = parseFloat(q.get("lng") ?? "");
    const label = q.get("label") ?? "Destination";
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setDropoff({ lat, lng, label });
    }
  }, []);

  // fetch estimate when vehicle or dropoff changes
  useEffect(() => {
    if (!dropoff) return;
    setEstimating(true);
    estimateFare(BERTOUA, dropoff, vehicle)
      .then(setEstimate)
      .catch(() => setEstimate(null))
      .finally(() => setEstimating(false));
  }, [vehicle, dropoff]);

  // move to accepted step when booking accepted
  useEffect(() => {
    if (booking?.status === "accepted" && step === "looking") {
      setStep("accepted");
      if (booking.provider_id) {
        getProvider(booking.provider_id).then(setProvider);
      }
    } else if (booking?.status === "completed" && (step === "accepted" || step === "looking")) {
      setStep("completed");
    }
  }, [booking, step]);

  const confirm = useCallback(async () => {
    if (!dropoff) return;
    setCreating(true);
    try {
      const b = await createBooking({
        passenger_id: "passenger-1",
        vehicle_type: vehicle,
        pickup: { ...BERTOUA, label: "Bertoua Centre" },
        dropoff,
      });
      setBookingId(b.id);
      setStep("looking");
    } finally {
      setCreating(false);
    }
  }, [dropoff, vehicle]);

  const cancel = useCallback(async () => {
    if (bookingId) await setBookingStatus(bookingId, "cancelled");
    setBookingId(null);
    setStep("choose");
  }, [bookingId]);

  const submitRating = useCallback(async () => {
    if (!bookingId || stars === 0) return;
    await rateBooking(bookingId, stars, comment);
    setRatingDone(true);
  }, [bookingId, stars, comment]);

  if (!dropoff) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <MapPinPlaceholder />
          <p className="text-charcoal/60 mt-2">{t("booking.pickFirst")}</p>
          <button onClick={() => router.back()} className="mt-4 text-green font-medium">
            ← {t("nav.home")}
          </button>
        </div>
      </div>
    );
  }

  if (step === "choose") {
    return (
      <div className="min-h-screen bg-ivory p-4">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-start gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green mt-2 shrink-0" />
              <div>
                <div className="text-xs text-charcoal/50 uppercase">Départ</div>
                <div className="text-sm font-medium text-charcoal">Bertoua Centre</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-orange mt-2 shrink-0" />
              <div>
                <div className="text-xs text-charcoal/50 uppercase">Arrivée</div>
                <div className="text-sm font-medium text-charcoal">{dropoff.label}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider mb-3">
              {t("booking.chooseVehicle")}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLES.map(({ type, Icon }) => (
                <button
                  key={type}
                  onClick={() => setVehicle(type)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition ${
                    vehicle === type ? "border-green bg-green/5" : "border-grey"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${vehicle === type ? "text-green" : "text-charcoal/50"}`} />
                  <span className="text-sm font-medium text-charcoal">{t(`home.service.${type === "taxi" ? "ride" : type === "truck" ? "cargo" : type}`)}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-grey pt-4">
              {estimating ? (
                <div className="flex items-center gap-2 text-charcoal/50">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t("booking.estimating")}</span>
                </div>
              ) : estimate ? (
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green">{estimate.fare_estimate_xaf.toLocaleString()} XAF</div>
                    <div className="text-xs text-charcoal/50 mt-1">
                      {(estimate.distance_m / 1000).toFixed(1)} km · ~{estimate.eta_min} min
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-charcoal/50 uppercase">{t("booking.payment")}</div>
                    <div className="text-sm font-medium text-charcoal">{t("booking.cash")}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-orange">{t("booking.noEstimate")}</div>
              )}
            </div>
          </div>

          <button
            onClick={confirm}
            disabled={creating || !estimate}
            className="w-full bg-orange text-white rounded-xl py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("booking.confirm")}
          </button>
        </div>
      </div>
    );
  }

  if (step === "looking") {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center p-6">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full bg-green/10 animate-ping" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-green animate-spin" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-charcoal mb-2">{t("booking.looking")}</h2>
        <p className="text-sm text-charcoal/50 mb-8 text-center">{t("booking.lookingHint")}</p>
        <button
          onClick={cancel}
          className="border border-grey rounded-xl px-6 py-2 text-sm font-medium text-charcoal"
        >
          {t("booking.cancel")}
        </button>
      </div>
    );
  }

  if (step === "accepted" && booking) {
    const currentIdx = STATUS_STEPS.indexOf(booking.status as any);
    const markers = [
      { id: "pickup", lat: booking.pickup.lat, lng: booking.pickup.lng, color: "#087C55", label: booking.pickup.label, size: "md" as const },
      { id: "dropoff", lat: booking.dropoff.lat, lng: booking.dropoff.lng, color: "#F28C28", label: booking.dropoff.label, size: "md" as const },
      ...(provider ? [{ id: provider.id, lat: provider.last_location.lat, lng: provider.last_location.lng, color: "#2563eb", label: provider.display_name, size: "md" as const }] : []),
    ];
    return (
      <div className="min-h-screen bg-ivory flex flex-col">
        <div className="h-[40vh] relative bg-white overflow-hidden">
          <MapContainer
            center={[booking.dropoff.lng, booking.dropoff.lat]}
            zoom={13}
            markers={markers}
            pickup={{ lat: booking.pickup.lat, lng: booking.pickup.lng }}
          />
        </div>
        <div className="flex-1 bg-white rounded-t-3xl -mt-4 p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-grey overflow-hidden shrink-0">
              {provider?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={provider.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-charcoal/40">?</div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-charcoal">{provider?.display_name ?? "Prestataire"}</div>
              <div className="text-xs text-charcoal/50">
                {provider ? `${provider.vehicle.brand} ${provider.vehicle.model} · ${provider.vehicle.plate}` : ""}
              </div>
              {provider && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Star className="w-3 h-3 text-orange fill-orange" />
                  <span className="text-xs font-medium text-charcoal">{provider.rating_avg}</span>
                  <span className="text-xs text-charcoal/40">({provider.rating_count})</span>
                </div>
              )}
            </div>
            <a href="tel:+237690000000" className="w-10 h-10 rounded-full bg-green/10 flex items-center justify-center">
              <Phone className="w-5 h-5 text-green" />
            </a>
          </div>

          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    i <= currentIdx ? "bg-green text-white" : "bg-grey text-charcoal/40"
                  }`}
                >
                  {i < currentIdx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <div className={`text-[10px] mt-1 text-center ${i <= currentIdx ? "text-green font-medium" : "text-charcoal/40"}`}>
                  {t(`booking.status.${s}`)}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-charcoal/50 uppercase">{t("booking.fare")}</div>
              <div className="text-xl font-bold text-green">{booking.fare_estimate_xaf.toLocaleString()} XAF</div>
            </div>
            <button onClick={cancel} className="flex items-center gap-1 text-orange text-sm font-medium">
              <X className="w-4 h-4" />
              {t("booking.cancel")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "completed" && booking) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green" />
        </div>
        <h2 className="text-xl font-bold text-charcoal mb-1">{t("booking.completed")}</h2>
        <div className="text-3xl font-bold text-green mt-4">{(booking.fare_final_xaf ?? booking.fare_estimate_xaf).toLocaleString()} XAF</div>
        <p className="text-xs text-charcoal/50 mt-1">{t("booking.cashCollected")}</p>

        {!ratingDone ? (
          <div className="w-full max-w-sm mt-8 bg-white rounded-2xl shadow-sm p-5">
            <div className="text-sm font-semibold text-charcoal/70 mb-3 text-center">{t("booking.rate")}</div>
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setStars(n)}>
                  <Star className={`w-8 h-8 ${n <= stars ? "text-orange fill-orange" : "text-grey"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("booking.comment")}
              className="w-full border border-grey rounded-xl p-3 text-sm focus:outline-none focus:border-green"
              rows={2}
            />
            <button
              onClick={submitRating}
              disabled={stars === 0}
              className="w-full mt-3 bg-green text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {t("booking.submitRating")}
            </button>
          </div>
        ) : (
          <p className="text-sm text-green mt-6">{t("booking.thanks")}</p>
        )}
      </div>
    );
  }

  return null;
}

function MapPinPlaceholder() {
  return (
    <div className="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center mx-auto">
      <Star className="w-8 h-8 text-green opacity-0" />
      <span className="absolute text-green text-2xl">📍</span>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 text-green animate-spin" /></div>}>
      <BookingFlowInner />
    </Suspense>
  );
}