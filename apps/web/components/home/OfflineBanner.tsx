"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflineBanner({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-orange border border-orange/30 text-orange rounded-lg px-3 py-2 mb-3 flex items-center gap-2 text-xs">
      <WifiOff className="w-4 h-4" />
      <span>{t("offline.banner")}</span>
      <button
        onClick={onRetry}
        className="ml-auto underline text-sm"
      >
        <RefreshCw className="w-3 h-3 inline mr-1" />
        {t("offline.retry")}
      </button>
    </div>
  );
}
