"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MapPin, Navigation, Clock, Phone, MessageCircle, Star, CheckCircle2, Loader2, X, ChevronRight, User } from "lucide-react";
import { BERTOUA } from "@/lib/supabase";

const MapContainer = dynamic(() => import("@/components/map/MapContainer"), { ssr: false });

type RideStatus = "searching" | "matched" | "arriving" | "in_trip" | "completed";

const STATUS_LABELS: Record<RideStatus, { fr: string; en: string; color: string }> = {
  searching: { fr: "Recherche d'un chauffeur...", en: "Searching for a driver...", color: "text-orange" },
  matched: { fr: "Chauffeur trouvé", en: "Driver matched", color: "text-green" },
  arriving: { fr: "Le chauffeur arrive", en: "Driver is arriving", color: "text-green" },
  in_trip: { fr: "En course", en: "In trip", color: "text-blue-600" },
  completed: { fr: "Course terminée", en: "Trip completed", color: "text-green" },
};

const MOCK_DRIVER = {
  name: "Jean Mbarga",
  rating: 4.8,
  trips: 342,
  vehicle: "Toyota Corolla · CE 1234 AB",
  phone: "+237699000001",
  photo: null,
};

export default function RidesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<RideStatus>("searching");
  const [eta, setEta] = useState(8);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    timers.push(setTimeout(() => setStatus("matched"), 3000));
    timers.push(setTimeout(() => setStatus("arriving"), 6000));
    timers.push(setTimeout(() => setStatus("in_trip"), 10000));
    timers.push(setTimeout(() => setStatus("completed"), 18000));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (status === "in_trip") {
      const id = setInterval(() => setProgress((p) => Math.min(100, p + 2)), 500);
      return () => clearInterval(id);
    }
  }, [status]);

  useEffect(() => {
    if (status === "arriving") {
      const id = setInterval(() => setEta((e) => Math.max(1, e - 1)), 2000);
      return () => clearInterval(id);
    }
  }, [status]);

  const isCompleted = status === "completed";

  const markers = [
    { id: "pickup", lat: BERTOUA.lat, lng: BERTOUA.lng, color: "#087C55", label: "Départ", size: "md" as const },
    { id: "dropoff", lat: BERTOUA.lat + 0.02, lng: BERTOUA.lng + 0.03, color: "#F28C28", label: "Arrivée", size: "md" as const },
  ];

  return (
    <main className="min-h-screen bg-ivory">
      {/* Map */}
      <div className="relative h-[55vh] bg-white overflow-hidden">
        <MapContainer
          center={[BERTOUA.lng, BERTOUA.lat]}
          zoom={13}
          markers={markers}
          pickup={{ lat: BERTOUA.lat, lng: BERTOUA.lng }}
          className="absolute inset-0"
        />
        {/* Status overlay */}
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="bg-white/95 backdrop-blur rounded-2xl shadow-lg p-4 flex items-center gap-3">
            {status === "searching" ? (
              <Loader2 className="w-6 h-6 text-orange animate-spin shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-green/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green" />
              </div>
            )}
            <div className="flex-1">
              <div className={`font-semibold ${STATUS_LABELS[status][locale === "fr" ? "fr" : "en"] ? "" : ""}`}>
                {STATUS_LABELS[status][locale === "fr" ? "fr" : "en"]}
              </div>
              {status === "arriving" && <div className="text-xs text-charcoal/60">Arrivée dans {eta} min</div>}
              {status === "in_trip" && <div className="text-xs text-charcoal/60">Progression: {progress}%</div>}
            </div>
            {!isCompleted && (
              <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-grey flex items-center justify-center">
                <X className="w-4 h-4 text-charcoal/60" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for in-trip */}
        {status === "in_trip" && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-grey">
            <div className="h-full bg-green transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-white rounded-t-3xl -mt-4 relative z-10 p-5 shadow-lg space-y-4">
        {/* Driver card (shown after match) */}
        {status !== "searching" && (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-grey overflow-hidden shrink-0 flex items-center justify-center">
              <User className="w-8 h-8 text-charcoal/30" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-charcoal text-lg">{MOCK_DRIVER.name}</div>
              <div className="text-sm text-charcoal/60">{MOCK_DRIVER.vehicle}</div>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3.5 h-3.5 text-orange fill-orange" />
                <span className="text-sm font-medium text-charcoal">{MOCK_DRIVER.rating}</span>
                <span className="text-xs text-charcoal/40">({MOCK_DRIVER.trips} courses)</span>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${MOCK_DRIVER.phone}`} className="w-11 h-11 rounded-full bg-green/10 flex items-center justify-center hover:bg-green/20 transition">
                <Phone className="w-5 h-5 text-green" />
              </a>
              <a href={`https://wa.me/${MOCK_DRIVER.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-green/10 flex items-center justify-center hover:bg-green/20 transition">
                <MessageCircle className="w-5 h-5 text-green" />
              </a>
            </div>
          </div>
        )}

        {/* Trip details */}
        <div className="bg-ivory rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-green mt-1.5 shrink-0" />
            <div>
              <div className="text-xs text-charcoal/50 uppercase">Départ</div>
              <div className="text-sm font-medium text-charcoal">Bertoua Centre</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-orange mt-1.5 shrink-0" />
            <div>
              <div className="text-xs text-charcoal/50 uppercase">Arrivée</div>
              <div className="text-sm font-medium text-charcoal">Marché Central, Bertoua</div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-grey">
            <div className="text-sm text-charcoal/60">Distance: 3.2 km</div>
            <div className="text-sm font-bold text-green">1 500 XAF</div>
          </div>
        </div>

        {/* Action buttons */}
        {isCompleted ? (
          <div className="space-y-3">
            <div className="text-center py-2">
              <CheckCircle2 className="w-12 h-12 text-green mx-auto mb-2" />
              <h3 className="text-lg font-bold text-charcoal">Course terminée !</h3>
              <p className="text-sm text-charcoal/60">Merci d&apos;avoir utilisé GoBert</p>
            </div>
            <button onClick={() => router.push(`/${locale}`)} className="w-full bg-green text-white rounded-xl py-3 font-semibold">
              Retour à l&apos;accueil
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button className="flex-1 border border-grey rounded-xl py-3 font-medium text-charcoal hover:bg-grey/30 transition">
              Annuler
            </button>
            <button className="flex-1 bg-orange text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2">
              <Navigation className="w-4 h-4" />
              Suivre en direct
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
