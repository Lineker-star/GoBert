"use client";
import { useTranslations } from "next-intl";

export default function ProviderDashboard() {
  const t = useTranslations("provider");
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-[#087C55] mb-4">{t("dashboard")}</h1>
      <button className="bg-[#087C55] text-white rounded-xl px-6 py-3 font-semibold">
        {t("goOnline")}
      </button>
    </main>
  );
}
