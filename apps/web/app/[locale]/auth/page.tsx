"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

const PREFIXES = [
  { code: "+237", label: "🇨🇲 +237" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+221", label: "🇸🇳 +221" },
  { code: "+225", label: "🇨🇮 +225" },
] as const;

const RESEND_SECONDS = 30;

export default function AuthPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { signInWithPhone, verifyOtp, resendOtp, signInAnonymous, session, loading: authLoading } = useAuth();

  const [prefix, setPrefix] = useState<string>("+237");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // redirect if already signed in
  useEffect(() => {
    if (!authLoading && session) {
      router.replace(`/${locale}/account`);
    }
  }, [authLoading, session, locale, router]);

  // resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const fullPhone = `${prefix}${phone.replace(/\D/g, "")}`;
  const phoneValid = phone.replace(/\D/g, "").length >= 8;

  const sendOtp = useCallback(async () => {
    if (!phoneValid) {
      setError("invalid_phone");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await signInWithPhone(fullPhone);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setStep("otp");
    setOtp("");
    setResendIn(RESEND_SECONDS);
  }, [phoneValid, fullPhone, signInWithPhone]);

  const verify = useCallback(async () => {
    if (otp.replace(/\D/g, "").length < 6) {
      setError("invalid_otp");
      return;
    }
    setError(null);
    setBusy(true);
    const { error: err } = await verifyOtp(fullPhone, otp);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace(`/${locale}/account`);
  }, [otp, fullPhone, verifyOtp, locale, router]);

  const resend = useCallback(async () => {
    if (resendIn > 0) return;
    setError(null);
    setBusy(true);
    const { error: err } = await resendOtp(fullPhone);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setResendIn(RESEND_SECONDS);
  }, [resendIn, fullPhone, resendOtp]);

  const continueAnonymous = useCallback(async () => {
    setError(null);
    setBusy(true);
    const { error: err } = await signInAnonymous();
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace(`/${locale}`);
  }, [signInAnonymous, locale, router]);

  const changeNumber = () => {
    setStep("phone");
    setOtp("");
    setError(null);
  };

  const errorMsg = error ? t(`auth.errors.${error}`) : null;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-ivory">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-green mb-1">{t("auth.title")}</h1>
        <p className="text-sm text-charcoal/60 mb-6">{t("auth.subtitle")}</p>

        {step === "phone" ? (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <select
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="border border-grey rounded-xl px-2 py-3 text-sm bg-white"
              >
                {PREFIXES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("auth.phonePlaceholder")}
                className="flex-1 border border-grey rounded-xl px-3 py-3 text-base focus:outline-none focus:border-green"
              />
            </div>
            {errorMsg && <p className="text-xs text-orange">{errorMsg}</p>}
            <button
              onClick={sendOtp}
              disabled={busy || !phoneValid}
              className="bg-orange text-white rounded-xl py-3 font-semibold disabled:opacity-50"
            >
              {busy ? t("auth.sending") : t("auth.sendOtp")}
            </button>
            <button
              onClick={continueAnonymous}
              disabled={busy}
              className="border border-grey rounded-xl py-3 font-medium text-charcoal disabled:opacity-50"
            >
              {t("auth.continueAnonymous")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-charcoal/70">
              {fullPhone}
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("auth.otpPlaceholder")}
              className="border border-grey rounded-xl px-3 py-3 text-2xl text-center tracking-[0.5em] font-mono focus:outline-none focus:border-green"
            />
            {errorMsg && <p className="text-xs text-orange">{errorMsg}</p>}
            <button
              onClick={verify}
              disabled={busy || otp.length < 6}
              className="bg-green text-white rounded-xl py-3 font-semibold disabled:opacity-50"
            >
              {busy ? t("auth.verifying") : t("auth.verify")}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button onClick={changeNumber} className="text-green font-medium">
                {t("auth.changeNumber")}
              </button>
              <button
                onClick={resend}
                disabled={resendIn > 0 || busy}
                className="text-green font-medium disabled:text-charcoal/40"
              >
                {resendIn > 0 ? t("auth.resendIn", { seconds: resendIn }) : t("auth.resend")}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}