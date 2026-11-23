"use client";
import { useTranslations } from "next-intl";
import { Bike, Car, Package, Truck, KeyRound, MapPin } from "lucide-react";

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
    <div className="relative min-h-screen">
      <div className="h-[55vh] bg-grey flex items-center justify-center">
        <div className="text-center text-charcoal/60">
          <MapPin className="w-8 h-8 mx-auto mb-2" />
          <p>Map placeholder (MapLibre to be wired)</p>
        </div>
      </div>
      <div className="bg-ivory rounded-t-2xl -mt-4 p-4 shadow-lg">
        <input
          className="w-full border rounded-xl p-3 text-lg mb-3"
          placeholder={t("whereTo")}
        />
        <div className="grid grid-cols-3 gap-2 mb-3">
          {SERVICES.map(({ key, Icon }) => (
            <button
              key={key}
              className="bg-white rounded-xl p-3 border flex flex-col items-center gap-1"
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{t(`service.${key}`)}</span>
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
      </div>
    </div>
  );
}
