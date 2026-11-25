"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import dynamic from "next/dynamic";
import MapContainer from "@/components/map/MapContainer";
import GeoLocationButton from "@/components/map/GeoLocationButton";
const SearchSheet = dynamic(() => import("@/components/search/SearchSheet"), { ssr: false });
import OfflineBanner from "@/components/home/OfflineBanner";
import ErrorState from "@/components/home/ErrorState";
import ProviderSkeleton from "@/components/home/ProviderSkeleton";
import ServiceChips from "@/components/home/ServiceChips";
import SavedPlaceChips from "@/components/home/SavedPlaceChips";
import { useProviders } from "@/hooks/useProviders";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { BERTOUA, type SavedPlace } from "@/lib/supabase";

type ServiceKey = "moto" | "ride" | "express" | "cargo" | "rent";

const SERVICES: ServiceKey[] = ["moto", "ride", "express", "cargo", "rent"];

export default function Home() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [mapKey, setMapKey] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [center, setCenter] = useState<[number, number]>([BERTOUA.lng, BERTOUA.lat]);
  const [zoom, setZoom] = useState(13);
  const [pickup, setPickup] = useState({ lat: BERTOUA.lat, lng: BERTOUA.lng });
  const [pickupLabel, setPickupLabel] = useState<string | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceKey | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const tmr = setTimeout(() => {
      if (!mapReady && !mapError) setMapError(true);
    }, 6000);
    return () => clearTimeout(tmr);
  }, [mapReady, mapError]);

  const { providers, markers, loading: providersLoading, error: providersError, retry: retryProviders, count } =
    useProviders({ lat: center[1], lng: center[0] });

  const filteredMarkers = selectedService
    ? markers.filter((m) => m.service === selectedService)
    : markers;

  const serviceCounts = SERVICES.map((key) => ({
    key,
    label: t(`home.service.${key}`),
    count: providers.filter((p) => p.service === key).length,
  }));

  const { places: savedPlaces, loading: savedLoading, save: savePlace } = useSavedPlaces(null, null);

  const handleLocation = useCallback((lat: number, lng: number) => {
    setCenter([lng, lat]);
    setPickup({ lat, lng });
    setMapError(false);
    setMapReady(false);
    setMapKey((k) => k + 1);
  }, []);

  const handlePickupDrag = useCallback((lat: number, lng: number) => {
    setPickup({ lat, lng });
  }, []);

  const handleRetry = useCallback(() => {
    setMapError(false);
    setMapReady(false);
    setMapKey((k) => k + 1);
  }, []);

  const handlePick = useCallback(
    (place: { lat: number; lng: number; label: string }) => {
      setDropoff(place);
      setCenter([place.lng, place.lat]);
      setSearchOpen(false);
      router.push(
        `/${locale}/booking?lat=${place.lat}&lng=${place.lng}&label=${encodeURIComponent(place.label)}`,
      );
    },
    [locale, router],
  );

  const openSearch = () => setSearchOpen(true);
  const closeSearch = () => setSearchOpen(false);

  const pickupMarker = {
    id: "pickup",
    lat: pickup.lat,
    lng: pickup.lng,
    color: "#F28C28",
    label: pickupLabel ?? t("map.pickup"),
    size: "md" as const,
  };

  return (
    <div className="relative min-h-screen bg-ivory">
      <OfflineBanner onRetry={retryProviders} />

      {/* Map panel */}
      <div className="relative bg-white overflow-hidden h-screen lg:h-[calc(100vh-0px)] lg:w-2/3">
        {mapError ? (
          <ErrorState
            message={t("map.failed")}
            onRetry={handleRetry}
            className="absolute inset-0 z-10"
          />
        ) : (
          <>
            <MapContainer
              key={mapKey}
              center={center}
              zoom={zoom}
              markers={filteredMarkers}
              pickup={pickupMarker}
              onPickupDragEnd={handlePickupDrag}
              onLoad={() => setMapReady(true)}
            />
            {!mapReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
                <div className="h-6 w-24 rounded-full bg-grey animate-pulse mb-2" />
                <p className="text-sm text-charcoal/60">{t("map.loading")}</p>
              </div>
            )}
          </>
        )}
        <div className="absolute top-4 left-4 z-20">
          <GeoLocationButton onLocation={handleLocation} />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-2 z-10 pointer-events-none">
          <div
            className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium shadow-md border ${
              pickupLabel ? "bg-white text-charcoal border-grey" : "bg-orange text-white border-orange/30"
            }`}
          >
            {pickupLabel ?? t("map.pickup")}
          </div>
        </div>
      </div>

      {/* Sheet panel */}
      <div className="lg:w-1/3 lg:block hidden lg:flex w-full h-full bg-white border-l border-grey p-6 overflow-y-auto">
        <SheetContent
          t={t}
          searchOpen={searchOpen}
          openSearch={openSearch}
          dropoff={dropoff}
          pickupLabel={pickupLabel ?? t("map.pickup")}
          providersLoading={providersLoading}
          providersError={providersError}
          count={count}
          serviceCounts={serviceCounts}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          savedPlaces={savedPlaces}
          savedLoading={savedLoading}
          onSavePlace={savePlace}
          onPlaceSelect={(lat, lng, label) => setCenter([lng, lat])}
          retryProviders={retryProviders}
        />
      </div>

      {/* Mobile bottom sheet */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-4 max-h-[55vh] z-30">
        <SheetContent
          t={t}
          searchOpen={searchOpen}
          openSearch={openSearch}
          dropoff={dropoff}
          pickupLabel={pickupLabel ?? t("map.pickup")}
          providersLoading={providersLoading}
          providersError={providersError}
          count={count}
          serviceCounts={serviceCounts}
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          savedPlaces={savedPlaces}
          savedLoading={savedLoading}
          onSavePlace={savePlace}
          onPlaceSelect={(lat, lng, label) => setCenter([lng, lat])}
          retryProviders={retryProviders}
        />
      </div>

      {/* Full-screen search sheet */}
      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={handlePick}
        near={BERTOUA}
        places={savedPlaces}
      />
    </div>
  );
}

type SheetContentProps = {
  t: ReturnType<typeof useTranslations>;
  searchOpen: boolean;
  openSearch: () => void;
  dropoff: { lat: number; lng: number; label: string } | null;
  pickupLabel: string;
  providersLoading: boolean;
  providersError: string | null;
  count: number;
  serviceCounts: { key: ServiceKey; label: string; count: number }[];
  selectedService: ServiceKey | null;
  setSelectedService: (key: ServiceKey) => void;
  savedPlaces: { id: string; label: string; lat: number; lng: number }[];
  savedLoading: boolean;
  onSavePlace: (place: Omit<SavedPlace, "id">) => void;
  onPlaceSelect: (lat: number, lng: number, label: string) => void;
  retryProviders: () => void;
};

function SheetContent({
  t,
  searchOpen,
  openSearch,
  dropoff,
  pickupLabel,
  providersLoading,
  providersError,
  count,
  serviceCounts,
  selectedService,
  setSelectedService,
  savedPlaces,
  savedLoading,
  onSavePlace,
  onPlaceSelect,
  retryProviders,
}: SheetContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
          {t("search.pickDestination")}
        </label>
        <button
          onClick={openSearch}
          className="text-sm font-medium text-green hover:underline transition-colors"
        >
          {t("search.pickDestination")}
        </button>
      </div>

      <div className="relative">
        <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-charcoal/40" />
        <input
          readOnly
          onClick={openSearch}
          placeholder={t("search.placeholder")}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-grey bg-white/80 text-charcoal cursor-pointer focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
        />
        {dropoff && (
          <div className="absolute right-3 top-2 text-[10px] text-green font-medium bg-green/10 px-2 py-0.5 rounded">
            {dropoff.label}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
          {t("providers.nearby")}
        </span>
        <span className="ml-auto text-sm font-medium text-charcoal">{count} {t("providers.available")}</span>
      </div>

      {providersError && (
        <ErrorState message={providersError} onRetry={retryProviders} className="max-w-xs" />
      )}

      {providersLoading ? (
        <ProviderSkeleton count={3} />
      ) : (
        <ServiceChips
          services={serviceCounts}
          selected={selectedService}
          onSelect={setSelectedService}
        />
      )}

      <div className="border-t border-grey pt-3">
        <SavedPlaceChips
          places={savedPlaces}
          selectedLabel={null}
          onSelect={({ lat, lng, label }) => {
            onPlaceSelect(lat, lng, label);
            onSavePlace({ label, lat, lng, address: null });
          }}
        />
      </div>
    </div>
  );
}
