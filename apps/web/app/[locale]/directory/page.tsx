"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Phone, Star, Navigation } from "lucide-react";
import { getDirectoryProviders, type DirectoryProvider } from "@/lib/booking-api";

export default function DirectoryPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [providers, setProviders] = useState<DirectoryProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDirectoryProviders()
      .then(setProviders)
      .catch(() => setProviders([]))
      .finally(() => setLoading(false));
  }, []);

  const book = (p: DirectoryProvider) => {
    const { lat, lng } = p.last_location;
    router.push(`/${locale}/booking?lat=${lat}&lng=${lng}&label=${encodeURIComponent(p.display_name)}`);
  };

  return (
    <div className="min-h-screen bg-ivory p-4">
      <div className="max-w-sm mx-auto space-y-4">
        <h1 className="text-xl font-bold text-green">{t("directory.title")}</h1>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-4 animate-pulse">
                <div className="h-4 bg-grey rounded w-2/3 mb-2" />
                <div className="h-3 bg-grey rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : providers.length === 0 ? (
          <p className="text-sm text-charcoal/50 text-center mt-10">{t("directory.empty")}</p>
        ) : (
          providers.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-grey overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.photo} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-charcoal">{p.display_name}</div>
                  <div className="text-xs text-charcoal/50">
                    {p.vehicle.brand} {p.vehicle.model} · {p.vehicle.plate}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Star className="w-3 h-3 text-orange fill-orange" />
                    <span className="text-xs font-medium text-charcoal">{p.rating_avg}</span>
                    <span className="text-xs text-charcoal/40">({p.rating_count})</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => book(p)}
                  className="flex-1 bg-green text-white rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1"
                >
                  <Navigation className="w-4 h-4" />
                  {t("directory.book")}
                </button>
                <a
                  href="tel:+237690000000"
                  className="flex-1 border border-grey rounded-xl py-2 text-sm font-medium text-charcoal flex items-center justify-center gap-1"
                >
                  <Phone className="w-4 h-4" />
                  {t("directory.callDirect")}
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}