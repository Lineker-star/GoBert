"use client";
import { useTranslations } from "next-intl";
import { Bike, Car, Package, Truck, KeyRound } from "lucide-react";

const SERVICES = [
  { key: "moto", Icon: Bike },
  { key: "ride", Icon: Car },
  { key: "express", Icon: Package },
  { key: "cargo", Icon: Truck },
  { key: "rent", Icon: KeyRound },
] as const;

export default function Home() {
  const t = useTranslations("home");
  return (
    <main className="min-h-screen p-6 flex flex-col gap-4">
      <h1 className="text-3xl font-bold text-[var(--green)]">{t("title")}</h1>
      <input
        className="border rounded-xl p-4 text-lg"
        placeholder={t("whereTo")}
      />
      <div className="grid grid-cols-3 gap-3">
        {SERVICES.map(({ key, Icon }) => (
          <button
            key={key}
            className="bg-white rounded-xl p-4 shadow text-center border flex flex-col items-center gap-2"
          >
            <Icon className="w-6 h-6" />
            <span className="text-sm font-medium">{t(`service.${key}`)}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {["home", "work", "market", "hospital", "carrefour"].map((q) => (
          <button key={q} className="border rounded-full px-3 py-1 text-sm">
            {t(`shortcut.${q}`)}
          </button>
        ))}
      </div>
    </main>
  );
}
