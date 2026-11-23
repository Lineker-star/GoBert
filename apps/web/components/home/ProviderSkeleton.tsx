"use client";
import { useTranslations } from "next-intl";

interface ProviderSkeletonProps {
  count?: number;
}

export default function ProviderSkeleton({ count = 3 }: ProviderSkeletonProps) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-charcoal">{t("providers.nearby")}</h3>
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-grey animate-pulse">
            <div className="w-10 h-10 rounded-full bg-grey" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-grey rounded w-3/4" />
              <div className="h-2.5 bg-grey rounded w-1/2" />
            </div>
            <div className="w-8 h-8 rounded-full bg-grey flex items-center justify-center text-xs font-medium text-charcoal/40">
              {i + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
