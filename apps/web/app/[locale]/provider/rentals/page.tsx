"use client";
import { useTranslations } from "next-intl";

export default function RentalsPage() {
  const t = useTranslations("provider");
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-[#087C55] mb-4">{t("rentals")}</h1>
      <p>{t("noRentals")}</p>
    </main>
  );
}
