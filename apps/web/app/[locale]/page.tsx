"use client";
import { useTranslations } from "next-intl";

const SERVICES = ["moto", "ride", "express", "cargo", "rent"] as const;

export default function Home() {
  const t = useTranslations("home");
  return (
    <main className="min-h-screen p-6 flex flex-col gap-4">
      <h1 className="text-3xl font-bold text-[#087C55]">{t("title")}</h1>
      <input
        className="border rounded-xl p-4 text-lg"
        placeholder={t("whereTo")}
      />
      <div className="grid grid-cols-3 gap-3">
        {SERVICES.map((s) => (
          <button
            key={s}
            className="bg-white rounded-xl p-4 shadow text-center border"
          >
            <span className="block text-2xl mb-1">ませ</span>
            <span className="text-sm font-medium">{t(`service.${s}`)}</span>
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
