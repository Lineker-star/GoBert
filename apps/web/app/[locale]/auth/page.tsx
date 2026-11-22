"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function AuthPage() {
  const t = useTranslations("auth");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold text-[#087C55]">{t("title")}</h1>
      {step === "phone" ? (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <input
            className="border rounded-lg p-3"
            placeholder={t("phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <button
            className="bg-[#F28C28] text-white rounded-lg p-3 font-semibold"
            onClick={() => setStep("otp")}
          >
            {t("sendOtp")}
          </button>
          <button
            className="border rounded-lg p-3"
            onClick={() => {}}
          >
            {t("continueAnonymous")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <input
            className="border rounded-lg p-3"
            placeholder={t("otpPlaceholder")}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <button className="bg-[#087C55] text-white rounded-lg p-3 font-semibold">
            {t("verify")}
          </button>
        </div>
      )}
    </main>
  );
}
