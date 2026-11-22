"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

const STEPS = ["identity", "vehicle", "documents", "services", "schedule", "review"] as const;

export default function OnboardPage() {
  const t = useTranslations("onboard");
  const [step, setStep] = useState(0);
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-[#087C55] mb-4">{t("title")}</h1>
      <p className="mb-4">{t("step")} {step + 1} / {STEPS.length}: {t(STEPS[step])}</p>
      <div className="flex gap-2">
        <button
          className="border rounded-lg px-4 py-2"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          {t("back")}
        </button>
        <button
          className="bg-[#087C55] text-white rounded-lg px-4 py-2"
          onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
        >
          {t("next")}
        </button>
      </div>
    </main>
  );
}
