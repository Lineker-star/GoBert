"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  Phone, ShieldCheck, User, Truck, ArrowRight, ArrowLeft, Loader2, CheckCircle2,
  Sparkles, Lock, Globe, Star, MapPin, Clock, MessageCircle, ChevronRight,
} from "lucide-react";

const PREFIXES = [
  { code: "+237", label: "🇨🇲 +237" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+221", label: "🇸🇳 +221" },
  { code: "+225", label: "🇨🇮 +225" },
] as const;

const RESEND_SECONDS = 30;

type Role = "user" | "provider";

export default function AuthPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { signInWithPhone, verifyOtp, resendOtp, signInAnonymous, session, loading: authLoading } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [prefix, setPrefix] = useState<string>("+237");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"role" | "phone" | "otp">("role");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (!authLoading && session) {
      router.replace(`/${locale}/account`);
    }
  }, [authLoading, session, locale, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const fullPhone = `${prefix}${phone.replace(/\D/g, "")}`;
  const phoneValid = phone.replace(/\D/g, "").length >= 8;

  const sendOtp = useCallback(async () => {
    if (!phoneValid) { setError("invalid_phone"); return; }
    setError(null); setBusy(true);
    const { error: err } = await signInWithPhone(fullPhone);
    setBusy(false);
    if (err) { setError(err); return; }
    setStep("otp"); setOtp(""); setResendIn(RESEND_SECONDS);
  }, [phoneValid, fullPhone, signInWithPhone]);

  const verify = useCallback(async () => {
    if (otp.replace(/\D/g, "").length < 6) { setError("invalid_otp"); return; }
    setError(null); setBusy(true);
    const { error: err } = await verifyOtp(fullPhone, otp);
    setBusy(false);
    if (err) { setError(err); return; }
    if (role === "provider") router.replace(`/${locale}/provider/onboard`);
    else router.replace(`/${locale}/account`);
  }, [otp, fullPhone, verifyOtp, role, locale, router]);

  const resend = useCallback(async () => {
    if (resendIn > 0) return;
    setError(null); setBusy(true);
    const { error: err } = await resendOtp(fullPhone);
    setBusy(false);
    if (err) { setError(err); return; }
    setResendIn(RESEND_SECONDS);
  }, [resendIn, fullPhone, resendOtp]);

  const continueAnonymous = useCallback(async () => {
    setError(null); setBusy(true);
    const { error: err } = await signInAnonymous();
    setBusy(false);
    if (err) { setError(err); return; }
    router.replace(`/${locale}`);
  }, [signInAnonymous, locale, router]);

  const errorMsg = error ? t(`auth.errors.${error}`) : null;

  const features = [
    { icon: <MapPin className="w-4 h-4" />, text: "Bertoua & régions Est, Adamoua, Nord, Extrême-Nord" },
    { icon: <Clock className="w-4 h-4" />, text: "Disponible 24h/24, 7j/7" },
    { icon: <ShieldCheck className="w-4 h-4" />, text: "Prestataires vérifiés par l'administration" },
    { icon: <MessageCircle className="w-4 h-4" />, text: "Support WhatsApp intégré" },
  ];

  return (
    <main className="min-h-screen relative overflow-hidden bg-gradient-to-br from-forest via-green to-green/80">
      {/* Decorative background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-ivory rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
          {/* Left: Branding */}
          <div className="text-white space-y-6 hidden md:block">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange flex items-center justify-center shadow-lg">
                <Truck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">GoBert</h1>
                <p className="text-white/70 text-sm">Mobilité &amp; logistique au Cameroun</p>
              </div>
            </div>
            <h2 className="text-4xl font-bold leading-tight">
              Votre trajet,<br />
              <span className="text-orange">en un clic.</span>
            </h2>
            <p className="text-white/80 text-lg leading-relaxed">
              Motos, taxis, tricycles, camions, location de véhicules et livraison express —
              tout ce dont vous avez besoin, à portée de main, même avec une connexion lente.
            </p>
            <ul className="space-y-3">
              {features.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-white/90">
                  <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">{f.icon}</span>
                  <span className="text-sm">{f.text}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-xs text-white/60 pt-4">
              <Star className="w-3 h-3 fill-orange text-orange" />
              <span>Noté 4.8/5 par nos utilisateurs</span>
            </div>
          </div>

          {/* Right: Auth card */}
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 md:p-10 border border-white/20">
            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-6 md:hidden">
              <div className="w-10 h-10 rounded-xl bg-orange flex items-center justify-center">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-green">GoBert</h1>
            </div>

            {step === "role" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-charcoal">{t("auth.title")}</h2>
                  <p className="text-sm text-charcoal/60 mt-1">{t("auth.subtitle")}</p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => { setRole("user"); setStep("phone"); }}
                    className="w-full group flex items-center gap-4 p-4 rounded-2xl border-2 border-grey hover:border-green bg-white hover:bg-green/5 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-green/10 flex items-center justify-center text-green group-hover:bg-green group-hover:text-white transition">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-charcoal">Utilisateur</div>
                      <div className="text-xs text-charcoal/60">Réserver des courses, livraisons et locations</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-charcoal/30 group-hover:text-green transition" />
                  </button>

                  <button
                    onClick={() => { setRole("provider"); setStep("phone"); }}
                    className="w-full group flex items-center gap-4 p-4 rounded-2xl border-2 border-grey hover:border-orange bg-white hover:bg-orange/5 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-charcoal">Prestataire</div>
                      <div className="text-xs text-charcoal/60">Proposer vos services et gagner de l&apos;argent</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-charcoal/30 group-hover:text-orange transition" />
                  </button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-grey" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-charcoal/40">ou</span></div>
                </div>

                <button
                  onClick={continueAnonymous}
                  disabled={busy}
                  className="w-full border border-grey rounded-xl py-3 font-medium text-charcoal hover:bg-grey/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-green" />}
                  {t("auth.continueAnonymous")}
                </button>

                <p className="text-[11px] text-charcoal/40 text-center">
                  En continuant, vous acceptez nos conditions d&apos;utilisation et notre politique de confidentialité.
                </p>
              </div>
            )}

            {step === "phone" && (
              <div className="space-y-5">
                <button onClick={() => { setStep("role"); setRole(null); }} className="flex items-center gap-1 text-sm text-charcoal/60 hover:text-green transition">
                  <ArrowLeft className="w-4 h-4" /> Retour
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-charcoal">
                    {role === "provider" ? "Inscription Prestataire" : "Connexion"}
                  </h2>
                  <p className="text-sm text-charcoal/60 mt-1">Entrez votre numéro de téléphone</p>
                </div>

                <div className="flex gap-2">
                  <select
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="border border-grey rounded-xl px-2 py-3 text-sm bg-white focus:outline-none focus:border-green"
                  >
                    {PREFIXES.map((p) => (
                      <option key={p.code} value={p.code}>{p.label}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t("auth.phonePlaceholder")}
                    className="flex-1 border border-grey rounded-xl px-4 py-3 text-base focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
                    autoFocus
                  />
                </div>
                {errorMsg && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>}
                <button
                  onClick={sendOtp}
                  disabled={busy || !phoneValid}
                  className="w-full bg-gradient-to-r from-green to-forest text-white rounded-xl py-3.5 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green/25 hover:shadow-green/40 transition"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  {busy ? t("auth.sending") : t("auth.sendOtp")}
                </button>
                <div className="flex items-center gap-2 text-xs text-charcoal/40 justify-center">
                  <Lock className="w-3 h-3" />
                  <span>Vos données sont chiffrées et sécurisées</span>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-5">
                <button onClick={() => setStep("phone")} className="flex items-center gap-1 text-sm text-charcoal/60 hover:text-green transition">
                  <ArrowLeft className="w-4 h-4" /> {t("auth.changeNumber")}
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-charcoal">{t("auth.verify")}</h2>
                  <p className="text-sm text-charcoal/60 mt-1">Code envoyé au <span className="font-medium text-charcoal">{fullPhone}</span></p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("auth.otpPlaceholder")}
                  className="w-full border border-grey rounded-xl px-4 py-4 text-3xl text-center tracking-[0.5em] font-mono focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
                  autoFocus
                />
                {errorMsg && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>}
                <button
                  onClick={verify}
                  disabled={busy || otp.length < 6}
                  className="w-full bg-gradient-to-r from-green to-forest text-white rounded-xl py-3.5 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green/25"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {busy ? t("auth.verifying") : t("auth.verify")}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button onClick={() => setStep("phone")} className="text-green font-medium hover:underline">
                    {t("auth.changeNumber")}
                  </button>
                  <button
                    onClick={resend}
                    disabled={resendIn > 0 || busy}
                    className="text-green font-medium disabled:text-charcoal/40 hover:underline"
                  >
                    {resendIn > 0 ? t("auth.resendIn", { seconds: resendIn }) : t("auth.resend")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
