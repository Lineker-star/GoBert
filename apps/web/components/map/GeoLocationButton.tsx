"use client";
import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { MapPin, AlertCircle, Crosshair } from "lucide-react";

type GeoStatus = "idle" | "loading" | "granted" | "denied" | "unavailable" | "error";

interface GeoLocationButtonProps {
  onLocation: (lat: number, lng: number) => void;
  className?: string;
}

export default function GeoLocationButton({ onLocation, className }: GeoLocationButtonProps) {
  const t = useTranslations();
  const [status, setStatus] = useState<GeoStatus>("idle");

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("granted");
        onLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else if (err.code === err.POSITION_UNAVAILABLE) setStatus("unavailable");
        else setStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [onLocation]);

  const clear = useCallback(() => setStatus("idle"), []);

  let message: React.ReactNode;
  let icon: React.ReactNode = <Crosshair className="w-5 h-5" />;
  let tone = "bg-white border border-grey";

  switch (status) {
    case "loading":
      message = t("geo.acquired");
      tone = "bg-green/10 border-green/20 text-green";
      icon = <Crosshair className="w-5 h-5 animate-spin" />;
      break;
    case "granted":
      message = t("geo.acquired");
      tone = "bg-green/10 border-green/20 text-green";
      icon = <Crosshair className="w-5 h-5 text-green" />;
      setTimeout(clear, 1500);
      break;
    case "denied":
      message = t("geo.denied");
      tone = "bg-orange/10 border-orange/20 text-orange";
      icon = <AlertCircle className="w-5 h-5 text-orange" />;
      break;
    case "unavailable":
      message = t("geo.unavailable");
      tone = "bg-orange/10 border-orange/20 text-orange";
      icon = <AlertCircle className="w-5 h-5 text-orange" />;
      break;
    case "error":
      message = t("geo.fallback");
      tone = "bg-orange/10 border-orange/20 text-orange";
      icon = <AlertCircle className="w-5 h-5 text-orange" />;
      break;
    default:
      message = t("geo.button");
  }

  return (
    <div className={className}>
      <button
        onClick={requestLocation}
        disabled={status === "loading"}
        className={`
          inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition
          ${tone}
        `}
      >
        {icon}
        <span>{message}</span>
      </button>
      {status === "denied" || status === "unavailable" || status === "error" ? (
        <p className="mt-1 text-xs text-charcoal/60">{t("geo.fallback")}</p>
      ) : null}
    </div>
  );
}
