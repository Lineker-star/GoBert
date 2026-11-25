"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  Truck, MapPin, Clock, ShieldCheck, MessageCircle, Star, ArrowRight,
  User, Sparkles, Loader2, ChevronRight, Globe, Lock, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

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

const SERVICES = [
  {
    id: "moto",
    icon: "🏍️",
    title: { en: "GoBert Moto", fr: "GoBert Moto" },
    desc: { en: "Motorcycle taxis for quick trips", fr: "Taxis-moto pour des trajets rapides" },
  },
  {
    id: "ride",
    icon: "🚕",
    title: { en: "GoBert Ride", fr: "GoBert Ride" },
    desc: { en: "Taxi and private car bookings", fr: "Réservation de taxis et voitures" },
  },
  {
    id: "express",
    icon: "📦",
    title: { en: "GoBert Express", fr: "GoBert Express" },
    desc: { en: "Fast package delivery", fr: "Livraison rapide de colis" },
  },
  {
    id: "cargo",
    icon: "🚚",
    title: { en: "GoBert Cargo", fr: "GoBert Cargo" },
    desc: { en: "Goods transportation and delivery", fr: "Transport et livraison de marchandises" },
  },
  {
    id: "rent",
    icon: "🚗",
    title: { en: "GoBert Rent", fr: "GoBert Location" },
    desc: { en: "Vehicle rentals by hour or day", fr: "Location de véhicules à l'heure ou à la journée" },
  },
];

const FEATURES = [
  {
    icon: <MapPin className="w-5 h-5" />,
    title: { en: "Real-time tracking", fr: "Suivi en temps réel" },
    desc: { en: "Track your ride from pickup to dropoff", fr: "Suivez votre course de la prise en charge au dépôt" },
  },
  {
    icon: <ShieldCheck className="w-5 h-5" />,
    title: { en: "Verified providers", fr: "Prestataires vérifiés" },
    desc: { en: "Background-checked drivers and insured vehicles", fr: "Chauffeurs vérifiés et véhicules assurés" },
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: { en: "24/7 availability", fr: "Disponible 24h/24" },
    desc: { en: "Rides and deliveries around the clock", fr: "Courses et livraisons à toute heure" },
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    title: { en: "WhatsApp support", fr: "Support WhatsApp" },
    desc: { en: "Help when you need it, in your language", fr: "Aide quand vous en avez besoin, dans votre langue" },
  },
];

export default function LandingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { session, loading: authLoading, signInWithPhone, verifyOtp, signInAnonymous } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [prefix, setPrefix] = useState<string>("+237");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"hero" | "role" | "phone" | "otp">("hero");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoading && session) {
      router.replace(`/${locale}`);
    }
  }, [authLoading, session, locale, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const fullPhone = `${prefix}${phone.replace(/\D/g, "")}`;
  const phoneValid = phone.replace(/\D/g, "").length >= 8;

  const sendOtp = async () => {
    if (!phoneValid) { setError("invalid_phone"); return; }
    setError(null); setBusy(true);
    const { error: err } = await signInWithPhone(fullPhone);
    setBusy(false);
    if (err) { setError(err); return; }
    setStep("otp"); setOtp(""); setResendIn(RESEND_SECONDS);
  };

  const verify = async () => {
    if (otp.replace(/\D/g, "").length < 6) { setError("invalid_otp"); return; }
    setError(null); setBusy(true);
    const { error: err } = await verifyOtp(fullPhone, otp);
    setBusy(false);
    if (err) { setError(err); return; }
    if (role === "provider") router.replace(`/${locale}/provider/onboard`);
    else router.replace(`/${locale}`);
  };

  const continueAnonymous = async () => {
    setError(null); setBusy(true);
    const { error: err } = await signInAnonymous();
    setBusy(false);
    if (err) { setError(String(err)); return; }
    router.replace(`/${locale}`);
  };

  const errorMsg = error ? `Error: ${error}` : null;

  return (
    <div className="min-h-screen relative overflow-hidden bg-ivory">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] bg-green/10 rounded-full blur-[120px] md:w-[800px] md:h-[800px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[700px] h-[700px] bg-orange/10 rounded-full blur-[120px] md:w-[900px] md:h-[900px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-white/40 rounded-full blur-[80px] md:w-[500px] md:h-[500px]" />
      </div>

      {step === "hero" && (
        <>
          {/* Navbar */}
          <nav className="relative z-20 flex items-center justify-between px-4 py-4 md:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-green flex items-center justify-center shadow-lg shadow-green/25">
                <Truck className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-charcoal tracking-tight">GoBert</span>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-charcoal/70">
              <Link href={`/${locale}`} className="hover:text-green transition-colors">
                How it works
              </Link>
              <Link href={`/${locale}`} className="hover:text-green transition-colors">
                Services
              </Link>
              <a href="https://wa.me/237600000000" className="hover:text-green transition-colors">
                Support
              </a>
              <button
                onClick={() => setStep("role")}
                className="hidden sm:inline-flex px-5 py-2.5 bg-charcoal text-white rounded-xl font-medium hover:bg-green/90 transition-all shadow-md shadow-charcoal/20"
              >
                Sign up
              </button>
            </div>
            <div className="md:hidden flex items-center gap-3">
              <Globe className="w-5 h-5 text-charcoal" />
              <button
                onClick={() => setStep("role")}
                className="px-4 py-2 bg-charcoal text-white rounded-xl font-medium hover:bg-green/90 transition-all text-sm"
              >
                Sign up
              </button>
            </div>
          </nav>

          {/* Hero section */}
          <div className="relative z-10 px-4 pt-16 pb-12 md:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                <div className="space-y-6 animate-fade-in-up">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green/10 text-green text-sm font-medium border border-green/20">
                    <span>🇨🇲</span>
                    <span>Available in Bertoua & all Cameroon regions</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold text-charcoal leading-tight">
                    Move.<br />
                    <span className="text-green">Connect.</span> Go.
                  </h1>
                  <p className="text-base md:text-lg text-charcoal/70 leading-relaxed max-w-lg">
                    Born in Bertoua. Built for Cameroon. Ready for Africa.
                    Motos, taxis, tricycles, trucks, vehicle rentals and express delivery —
                    everything you need, at your fingertips, even on slow connections.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={() => setStep("role")}
                      className="w-full sm:w-auto px-8 py-4 bg-charcoal text-white text-lg font-bold rounded-2xl hover:bg-green/90 transition-all shadow-lg shadow-charcoal/20 active:scale-95"
                    >
                      Get started &mdash; it&apos;s free
                    </button>
                    <button
                      onClick={continueAnonymous}
                      disabled={busy}
                      className="w-full sm:w-auto px-8 py-4 bg-white text-charcoal border border-grey text-lg font-bold rounded-2xl hover:bg-grey/50 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                    >
                      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 text-green" />}
                      Continue as guest
                    </button>
                  </div>
                  <div className="mt-6 flex items-center gap-3 text-xs text-charcoal/40">
                    <Star className="w-3 h-3 fill-orange text-orange" />
                    <span>Rated 4.8/5 by 12,000+ users</span>
                    <span className="w-px h-4 bg-grey mx-2" />
                    <span>24/7 service in Bertoua</span>
                  </div>
                </div>

                <div className="relative animate-fade-in-up stagger-2">
                  <div className="absolute -inset-1 bg-gradient-to-r from-green to-orange rounded-3xl blur opacity-20" />
                  <div className="relative rounded-3xl bg-white shadow-2xl border border-grey overflow-hidden shadow-glow">
                    <div className="grid grid-cols-2 gap-1 p-2">
                      {SERVICES.map((s, i) => (
                        <button
                          key={s.id}
                          onClick={() => setStep("role")}
                          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/50 hover:bg-green/5 border border-transparent hover:border-green transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-charcoal/5 flex items-center justify-center text-2xl group-hover:scale-110 transition-all">
                            {s.icon}
                          </div>
                          <span className="text-xs font-medium text-charcoal group-hover:text-green transition-colors">
                            {s.title.en}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="py-20 px-4 md:px-6 bg-white">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-16 animate-fade-in-up">
                <h2 className="text-3xl md:text-4xl font-bold text-charcoal">Why choose GoBert?</h2>
                <p className="text-charcoal/60 mt-4 text-lg max-w-2xl mx-auto">
                  Reliable, affordable, and built for local needs — even on slow connections.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {FEATURES.map((f, i) => (
                  <div
                    key={i}
                    className="p-6 rounded-2xl bg-ivory border border-grey hover:border-green/50 transition-all group hover:shadow-lg animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-green/10 flex items-center justify-center text-green mb-4 group-hover:bg-green group-hover:text-white transition-all">
                      {f.icon}
                    </div>
                    <h3 className="font-bold text-charcoal mb-2">{f.title.en}</h3>
                    <p className="text-sm text-charcoal/60 leading-relaxed">{f.desc.en}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="py-20 px-4 md:px-6">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal mb-6">Ready to ride?</h2>
              <p className="text-charcoal/60 mb-8 text-lg max-w-lg mx-auto">
                Join thousands of users across Cameroon.
              </p>
              <button
                onClick={() => setStep("role")}
                className="px-10 py-4 bg-gradient-to-r from-green to-forest text-white text-lg font-bold rounded-2xl hover:from-green-dark hover:to-forest transition-all shadow-lg shadow-glow active:scale-95"
              >
                Create your account <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Auth/signup flow (overlaid on hero or full screen) */}
      {step !== "hero" && (
        <div className="min-h-screen flex items-center justify-center px-4 md:px-6 bg-charcoal/5">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 md:p-8 border border-grey/30">
            {/* Header */}
            <div className="mb-8">
              <Link href={`/${locale}`} className="inline-flex items-center gap-2 text-sm text-charcoal/60 hover:text-green transition-colors mb-4">
                <ArrowLeft className="w-4 h-4" /> Back to home
              </Link>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-green flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-charcoal tracking-tight">GoBert</span>
              </div>
            </div>

            {step === "role" && (
              <div className="space-y-5">
                <h2 className="text-2xl font-bold text-charcoal">Join GoBert</h2>
                <p className="text-charcoal/60">Choose how you&apos;d like to use GoBert</p>

                <div className="space-y-3">
                  <button
                    onClick={() => { setRole("user"); setStep("phone"); }}
                    className="w-full group flex items-center gap-4 p-4 rounded-2xl border-2 border-grey hover:border-green bg-white hover:bg-green/5 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-green/10 flex items-center justify-center text-green group-hover:bg-green group-hover:text-white transition-all">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-charcoal">Rider</div>
                      <div className="text-xs text-charcoal/60">Book rides, deliveries, and rentals</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-charcoal/30 group-hover:text-green transition-colors" />
                  </button>

                  <button
                    onClick={() => { setRole("provider"); setStep("phone"); }}
                    className="w-full group flex items-center gap-4 p-4 rounded-2xl border-2 border-grey hover:border-orange bg-white hover:bg-orange/5 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange/10 flex items-center justify-center text-orange group-hover:bg-orange group-hover:text-white transition-all">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-charcoal">Service Provider</div>
                      <div className="text-xs text-charcoal/60">Offer rides and earn money</div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-charcoal/30 group-hover:text-orange transition-colors" />
                  </button>
                </div>

                <div className="relative mt-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-grey" /></div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-charcoal/40">Or continue as guest</span>
                  </div>
                </div>

                <button
                  onClick={continueAnonymous}
                  disabled={busy}
                  className="w-full border border-grey rounded-xl py-3 font-medium text-charcoal hover:bg-grey/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-green" />}
                  Continue as guest
                </button>
              </div>
            )}

            {step === "phone" && (
              <div className="space-y-5">
                <button
                  onClick={() => { setStep("role"); setRole(null); }}
                  className="flex items-center gap-1 text-sm text-charcoal/60 hover:text-green transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-charcoal">
                    {role === "provider" ? "Provider signup" : "Create account"}
                  </h2>
                  <p className="text-sm text-charcoal/60 mt-1">Enter your phone number</p>
                </div>

                <div className="flex gap-2">
                  <select
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="border border-grey rounded-xl px-2 py-3 text-sm bg-white focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
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
                    placeholder="6 XX XXX XXX"
                    className="flex-1 border border-grey rounded-xl px-4 py-3 text-base focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
                    autoFocus
                  />
                </div>
                {errorMsg && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>}
                <button
                  onClick={sendOtp}
                  disabled={busy || !phoneValid}
                  className="w-full bg-gradient-to-r from-green to-forest text-white rounded-xl py-3.5 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-glow hover:shadow-green/40 transition-all active:scale-95"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  {busy ? "Sending code..." : "Send verification code"}
                </button>
                <div className="flex items-center gap-2 text-xs text-charcoal/40 justify-center">
                  <Lock className="w-3 h-3" />
                  <span>Your data is encrypted and secure</span>
                </div>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-5">
                <button onClick={() => setStep("phone")} className="flex items-center gap-1 text-sm text-charcoal/60 hover:text-green transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Change number
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-charcoal">Verify your number</h2>
                  <p className="text-sm text-charcoal/60 mt-1">Code sent to <span className="font-medium text-charcoal">{fullPhone}</span></p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="⬚⬚⬚⬚⬚⬚"
                  className="w-full border border-grey rounded-xl px-4 py-4 text-3xl text-center tracking-[0.5em] font-mono focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20"
                  autoFocus
                />
                {errorMsg && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>}
                <button
                  onClick={verify}
                  disabled={busy || otp.length < 6}
                  className="w-full bg-gradient-to-r from-green to-forest text-white rounded-xl py-3.5 font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-glow hover:shadow-green/40 transition-all active:scale-95"
                >
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                  {busy ? "Verifying..." : "Verify & continue"}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button onClick={() => setStep("phone")} className="text-green font-medium hover:underline transition-colors">
                    Change number
                  </button>
                  <button
                    onClick={() => {}}
                    disabled={resendIn > 0 || busy}
                    className="text-green font-medium disabled:text-charcoal/40 hover:underline transition-colors"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
