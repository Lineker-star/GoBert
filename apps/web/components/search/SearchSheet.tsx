"use client";
import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Search, MapPin, ChevronRight } from "lucide-react";
import { useSearchPlaces } from "@/hooks/useSearchPlaces";
import type { Place } from "@/lib/geocode";

interface SearchSheetProps {
  near: { lat: number; lng: number };
  places: { id: string; label: string; lat: number; lng: number }[];
  onPick: (place: { lat: number; lng: number; label: string }) => void;
  onClose: () => void;
  open: boolean;
}

export default function SearchSheet({ near, places, onPick, onClose, open }: SearchSheetProps) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<"saved" | "results" | null>(null);
  const { results, loading } = useSearchPlaces(query, near, true);

  const handleSaved = useCallback(
    (p: { lat: number; lng: number; label: string }) => {
      setQuery("");
      setFocus(null);
      onPick(p);
    },
    [onPick],
  );

  const handleResult = useCallback(
    (p: Place) => {
      setQuery("");
      setFocus(null);
      onPick({ lat: p.lat, lng: p.lng, label: p.label });
    },
    [onPick],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-forest p-4 flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-full text-white hover:bg-white/10" aria-label={t("common.back")}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-white">{t("search.pickDestination")}</h2>
      </div>
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 w-4 h-4 text-charcoal/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full h-12 pl-9 pr-3 rounded-xl border border-grey bg-white text-[15px] text-charcoal focus:outline-none focus:border-green focus:ring-4 focus:ring-green/10"
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-charcoal/50" />
            <span className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
              {t("search.savedPlaces")}
            </span>
          </div>
          <div className="space-y-1">
            {places.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSaved({ lat: p.lat, lng: p.lng, label: p.label })}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-grey bg-white text-left text-charcoal hover:bg-charcoal/5 hover:border-green/30 transition"
              >
                <MapPin className="w-4 h-4 text-green" />
                <div>
                  <div className="text-sm font-medium">{p.label}</div>
                  
                </div>
                <ChevronRight className="ml-auto w-3 h-3 text-charcoal/40" />
              </button>
            ))}
            {places.length === 0 && (
              <div className="px-3 py-2 text-xs text-charcoal/40">{t("saved.empty")}</div>
            )}
          </div>
        </div>

        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-charcoal/50" />
            <span className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
              {t("search.results")}
            </span>
          </div>
          {loading && (
            <div className="h-8 w-24 rounded bg-grey animate-pulse" />
          )}
          {!loading && results.length === 0 && query.trim() && (
            <div className="px-3 py-2 text-xs text-charcoal/40">{t("search.noResults")}</div>
          )}
          <div className="space-y-1">
            {results.map((p) => (
              <button
                key={`${p.lat},${p.lng}`}
                onClick={() => handleResult(p)}
                className="w-full flex items-start gap-2 px-3 py-2 rounded-lg border border-grey bg-white text-left text-charcoal hover:bg-charcoal/5 transition"
              >
                <MapPin className="w-4 h-4 mt-0.5 text-green shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium truncate">{p.label}</div>
                  {p.address && (
                    <div className="text-xs text-charcoal/50 truncate max-w-[240px]">{p.address}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {query.trim() && !loading && results.length === 0 && (
          <div className="mt-4 p-3 rounded-xl border border-grey/30 bg-charcoal/5 text-xs text-charcoal/60">
            {t("search.noResults")}
          </div>
        )}
      </div>
    </div>
  );
}
