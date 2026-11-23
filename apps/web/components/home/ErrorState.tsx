"use client";
import { useTranslations } from "next-intl";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

export default function ErrorState({ message, onRetry, className }: ErrorStateProps) {
  const t = useTranslations();
  return (
    <div className={`h-full flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-grey bg-white/60 ${className ?? ""}`}>
      <AlertCircle className="w-10 h-10 mx-auto text-orange mb-3" />
      <h3 className="text-lg font-semibold text-charcoal">{message}</h3>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium border border-orange rounded-lg text-orange hover:bg-orange/5 transition"
      >
        <RefreshCw className="w-3 h-3" />
        {t("map.retry")}
      </button>
    </div>
  );
}
