"use client";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";

interface SavedPlaceChipProps {
  place: { id: string; label: string; lat: number; lng: number; address?: string | null };
  selected: boolean;
  onSelect: (place: { lat: number; lng: number; label: string }) => void;
}

export function SavedPlaceChip({ place, selected, onSelect }: SavedPlaceChipProps) {
  const t = useTranslations();
  return (
    <button
      onClick={() => onSelect({ lat: place.lat, lng: place.lng, label: place.label })}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition
        ${selected
          ? "bg-green border-green text-green"
          : "bg-white border-grey text-charcoal hover:bg-charcoal/5"}
      `}
    >
      <MapPin className={`w-4 h-4 ${selected ? "" : "text-charcoal/60"}`} />
      <span>{place.label}</span>
    </button>
  );
}

interface SavedPlaceChipsProps {
  places: { id: string; label: string; lat: number; lng: number; address?: string | null }[];
  selectedLabel: string | null;
  onSelect: (place: { lat: number; lng: number; label: string }) => void;
  className?: string;
}

export default function SavedPlaceChips({ places, selectedLabel, onSelect, className }: SavedPlaceChipsProps) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <MapPin className="w-4 h-4 text-charcoal/50" />
        <span className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">{t("search.savedPlaces")}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {places.map((p) => (
          <SavedPlaceChip
            key={p.id}
            place={p}
            selected={selectedLabel === p.label}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
