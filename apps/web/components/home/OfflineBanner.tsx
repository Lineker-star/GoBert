"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw, WifiOff } from "lucide-react";

/** Global connectivity banner. Rendered once in the locale layout. */
export default function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  const t = useTranslations();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-2 inset-x-2 z-[70] mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-charcoal px-4 py-3 text-sm text-white shadow-xl" role="status">
      <WifiOff className="w-4 h-4 shrink-0 text-orange" />
      <span className="flex-1">{t("offline.banner")}</span>
      <button onClick={() => (onRetry ? onRetry() : window.location.reload())} className="inline-flex items-center gap-1 font-bold text-orange">
        <RefreshCw className="w-3.5 h-3.5" />
        {t("offline.retry")}
      </button>
    </div>
  );
}
