"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bike, Building2, ChevronRight, Info, Lock, Sparkles, UserRound } from "lucide-react";
import { useAuth, MIN_PASSWORD } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/mock-store";
import { isValidCameroonMobile, normalizePhone } from "@/lib/format";
import { CITIES } from "@/lib/constants";
import { Alert, Button, Field, Input, Select, cx } from "@/components/ui/primitives";
import { LanguageSwitcher, Logo } from "@/components/ui/brand";

const PREFIXES = [
  { code: "+237", label: "🇨🇲 +237" },
  { code: "+236", label: "🇨🇫 +236" },
  { code: "+235", label: "🇹🇩 +235" },
  { code: "+241", label: "🇬🇦 +241" },
  { code: "+234", label: "🇳🇬 +234" },
  { code: "+33", label: "🇫🇷 +33" },
] as const;

const RESEND_SECONDS = 30;
const ROLES: { role: UserRole; icon: React.ElementType; tone: string }[] = [
  { role: "customer", icon: UserRound, tone: "bg-green/10 text-green group-hover:bg-green group-hover:text-white" },
  { role: "rider", icon: Bike, tone: "bg-orange/15 text-[#B25E0B] group-hover:bg-orange group-hover:text-white" },
  { role: "business", icon: Building2, tone: "bg-forest/10 text-forest group-hover:bg-forest group-hover:text-white" },
];

type Step = "role" | "phone" | "otp" | "profile" | "reset";

export default function AuthPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const auth = useAuth();
  const { session, profile, loading, profileLoading, isAnonymous, isMock } = auth;

  const [step, setStep] = useState<Step>("role");
  const [role, setRole] = useState<UserRole | null>(null);
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [next, setNext] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("+237");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Bertoua");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [ready, setReady] = useState(false);
  const [method, setMethod] = useState<"sms" | "password" | "email">("sms");
  const [password, setPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const finishing = useRef(false);

  // Read query params once (avoids a Suspense boundary for useSearchParams).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const r = q.get("role");
    if (r === "customer" || r === "rider" || r === "business") {
      setRole(r);
      setStep("phone");
    }
    if (q.get("mode") === "login") {
      setMode("login");
      setStep("phone");
    }
    if (q.get("step") === "profile") setStep("profile");
    // Arrived from a password-reset email: Supabase puts type=recovery in the URL hash.
    if (q.get("reset") === "1" || window.location.hash.includes("type=recovery")) setStep("reset");
    const n = q.get("next");
    if (n && n.startsWith("/")) setNext(n);
    setReady(true);
  }, []);

  const destination = useCallback(
    (r: UserRole) => (r === "customer" ? next || `/${locale}` : `/${locale}/onboard`),
    [locale, next],
  );

  // Already registered → leave the auth page. Signed in without a profile → finish sign-up.
  useEffect(() => {
    // While finishing sign-up, finish() decides where to go (onboarding for riders/businesses).
    if (!ready || loading || profileLoading || finishing.current || step === "reset") return;
    if (session && !isAnonymous && profile) {
      router.replace(profile.role === "customer" ? next || `/${locale}` : `/${locale}/dashboard`);
    } else if (session && !isAnonymous && !profile && step !== "profile") {
      setStep("profile");
    }
  }, [ready, loading, profileLoading, session, isAnonymous, profile, step, router, locale, next]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const local = phone.replace(/\D/g, "");
  const phoneValid = prefix === "+237" ? isValidCameroonMobile(local) : local.length >= 7;
  const fullPhone = normalizePhone(prefix, local);

  const sendOtp = async () => {
    if (!phoneValid) return setError("invalid_phone");
    setError(null);
    setBusy(true);
    const { error: err } = await auth.signInWithPhone(fullPhone);
    setBusy(false);
    if (err) return setError(err);
    setOtp("");
    setStep("otp");
    setResendIn(RESEND_SECONDS);
  };

  const resend = async () => {
    if (resendIn > 0) return;
    setBusy(true);
    const { error: err } = await auth.resendOtp(fullPhone);
    setBusy(false);
    if (err) return setError(err);
    setResendIn(RESEND_SECONDS);
  };

  const afterAuth = (res: { error: string | null; hasProfile?: boolean; role?: UserRole | null }) => {
    if (res.error) return setError(res.error);
    if (res.hasProfile && res.role) router.replace(res.role === "customer" ? next || `/${locale}` : `/${locale}/dashboard`);
    else setStep("profile");
  };

  const verify = async () => {
    if (otp.length !== 6) return setError("invalid_otp");
    setError(null);
    setBusy(true);
    const res = await auth.verifyOtp(fullPhone, otp);
    setBusy(false);
    afterAuth(res);
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail);
  const redirectHere = () => `${window.location.origin}/${locale}/auth${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  /** Phone + password or email + password, for sign-up and sign-in. */
  const submitPassword = async () => {
    if (method === "email" && !emailValid) return setError("invalid_email");
    if (method === "password" && !phoneValid) return setError("invalid_phone");
    if (mode === "signup" && password.length < MIN_PASSWORD) return setError("weak_password");
    setError(null);
    setNotice(null);
    setBusy(true);
    const creds = method === "email" ? { email: loginEmail, password } : { phone: fullPhone, password };
    if (mode === "signup") {
      const res = await auth.signUpWithPassword(creds);
      setBusy(false);
      if (res.error) return setError(res.error === "already_registered" ? "already_registered" : res.error);
      if (res.needsConfirmation === "sms") {
        setOtp("");
        setStep("otp");
        setResendIn(RESEND_SECONDS);
        return;
      }
      if (res.needsConfirmation === "email") return setNotice(t("auth.confirmEmailSent", { email: loginEmail }));
      return afterAuth(res);
    }
    const res = await auth.signInWithPassword(creds);
    setBusy(false);
    afterAuth(res);
  };

  const magicLink = async () => {
    if (!emailValid) return setError("invalid_email");
    setBusy(true);
    setError(null);
    const { error: err } = await auth.sendMagicLink(loginEmail, redirectHere());
    setBusy(false);
    if (err) return setError(err);
    setNotice(t("auth.magicLinkSent", { email: loginEmail }));
  };

  const forgot = async () => {
    if (!emailValid) return setError("invalid_email");
    setBusy(true);
    setError(null);
    const { error: err } = await auth.requestPasswordReset(loginEmail, `${window.location.origin}/${locale}/auth?reset=1`);
    setBusy(false);
    if (err) return setError(err);
    setNotice(t("auth.resetSent", { email: loginEmail }));
  };

  const saveNewPassword = async () => {
    if (password.length < MIN_PASSWORD) return setError("weak_password");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) return setError("generic");
    setPassword("");
    router.replace(`/${locale}/dashboard`);
  };

  const finish = async () => {
    if (!role) return setError("role_required");
    if (fullName.trim().length < 2) return setError("name_required");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("invalid_email");
    if (!terms) return setError("terms_required");
    setError(null);
    setBusy(true);
    finishing.current = true;
    const { error: err } = await auth.completeRegistration({
      role,
      full_name: fullName.trim(),
      email: email.trim() || undefined,
      city,
      language: locale === "en" ? "en" : "fr",
    });
    setBusy(false);
    if (err) {
      finishing.current = false;
      return setError(err);
    }
    router.replace(destination(role));
  };

  const guest = async () => {
    setBusy(true);
    const { error: err } = await auth.signInAnonymous();
    setBusy(false);
    if (err) return setError(err);
    router.replace(next || `/${locale}`);
  };

  const errorMsg = error ? t(`auth.errors.${error}`) : null;
  const roleImage = role === "rider" ? "/brand/riders-group.webp" : role === "business" ? "/brand/driver.webp" : "/brand/moto-traffic.webp";

  return (
    <main className="min-h-dvh grid lg:grid-cols-[1fr_1.05fr] bg-ivory">
      {/* Visual side */}
      <aside className="relative hidden lg:block overflow-hidden bg-forest">
        <Image src={roleImage} alt="" fill priority sizes="50vw" className="object-cover opacity-70 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest via-forest/60 to-forest/10" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <Logo variant="white" className="h-12" />
          <p className="mt-6 text-4xl font-extrabold leading-tight text-white">
            {role ? t(`roles.${role}.title`) : t("auth.sideTitle")}
          </p>
          <p className="mt-3 max-w-md text-white/75">{role ? t(`roles.${role}.desc`) : t("auth.sideSubtitle")}</p>
        </div>
      </aside>

      {/* Form side */}
      <section className="flex flex-col">
        <div className="flex items-center justify-between px-5 py-4">
          <Logo href={`/${locale}`} className="h-9 lg:invisible" />
          <LanguageSwitcher />
        </div>
        <div className="flex flex-1 items-start sm:items-center justify-center px-5 pb-10">
          <div className="w-full max-w-md">
            {step === "role" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">{t("auth.chooseRole")}</h1>
                  <p className="mt-2 text-charcoal/60">{t("auth.chooseRoleHint")}</p>
                </div>
                <div className="space-y-3">
                  {ROLES.map(({ role: r, icon: Icon, tone }) => (
                    <button
                      key={r}
                      onClick={() => {
                        setRole(r);
                        setStep("phone");
                      }}
                      className="group w-full flex items-center gap-4 rounded-2xl border-2 border-grey bg-white p-4 text-left transition hover:border-green/50 hover:shadow-md"
                    >
                      <span className={cx("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition", tone)}>
                        <Icon className="w-6 h-6" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-bold text-charcoal">{t(`roles.${r}.label`)}</span>
                        <span className="block text-sm text-charcoal/55">{t(`roles.${r}.short`)}</span>
                      </span>
                      <ChevronRight className="w-5 h-5 text-charcoal/30 group-hover:text-green" />
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm text-charcoal/60">
                  {t("auth.haveAccount")}{" "}
                  <button
                    className="font-semibold text-green hover:underline"
                    onClick={() => {
                      setMode("login");
                      setStep("phone");
                    }}
                  >
                    {t("auth.signInLink")}
                  </button>
                </p>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center" aria-hidden>
                    <div className="w-full border-t border-grey" />
                  </div>
                  <p className="relative mx-auto w-fit bg-ivory px-3 text-xs text-charcoal/45">{t("auth.or")}</p>
                </div>
                <Button variant="outline" block onClick={guest} loading={busy}>
                  <Sparkles className="w-4 h-4 text-green" /> {t("auth.continueAnonymous")}
                </Button>
                <p className="text-center text-xs text-charcoal/45">{t("auth.guestNote")}</p>
              </div>
            )}

            {step === "phone" && (
              <div className="space-y-6 animate-fade-in">
                <button
                  onClick={() => {
                    setStep("role");
                    setMode("signup");
                    setError(null);
                  }}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/60 hover:text-green"
                >
                  <ArrowLeft className="w-4 h-4" /> {t("common.back")}
                </button>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">
                    {mode === "login" ? t("auth.loginTitle") : t(`auth.signupTitle.${role ?? "customer"}`)}
                  </h1>
                  <p className="mt-2 text-charcoal/60">{t(`auth.methodHint.${method}`)}</p>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white border border-grey p-1" role="tablist" aria-label={t("auth.methodLabel")}>
                  {(["sms", "password", "email"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={method === m}
                      onClick={() => {
                        setMethod(m);
                        setError(null);
                        setNotice(null);
                      }}
                      className={cx("h-10 rounded-xl text-xs font-bold transition", method === m ? "bg-green text-white" : "text-charcoal/60 hover:bg-charcoal/5")}
                    >
                      {t(`auth.methods.${m}`)}
                    </button>
                  ))}
                </div>
                {notice && (
                  <Alert tone="green" icon={<Info className="w-4 h-4" />}>
                    {notice}
                  </Alert>
                )}
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void (method === "sms" ? sendOtp() : submitPassword());
                  }}
                >
                  {method === "email" ? (
                    <Field label={t("auth.email")} htmlFor="login-email" error={error === "invalid_email" ? errorMsg : null}>
                      <Input id="login-email" type="email" autoComplete="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value.trim())} placeholder="nom@exemple.cm" autoFocus />
                    </Field>
                  ) : (
                  <Field label={t("auth.phoneLabel")} hint={t("auth.phoneHint")} error={error === "invalid_phone" ? errorMsg : null} htmlFor="phone">
                    <div className="flex gap-2">
                      <Select value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-[7.5rem] shrink-0" aria-label={t("auth.countryCode")}>
                        {PREFIXES.map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, "").slice(0, 14))}
                        placeholder="6 99 00 00 00"
                        autoFocus
                      />
                    </div>
                  </Field>
                  )}
                  {method !== "sms" && (
                    <Field
                      label={t("auth.password")}
                      htmlFor="password"
                      hint={mode === "signup" ? t("auth.passwordHint", { min: MIN_PASSWORD }) : undefined}
                      error={error === "weak_password" ? errorMsg : null}
                    >
                      <Input
                        id="password"
                        type="password"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={mode === "signup" ? MIN_PASSWORD : undefined}
                      />
                    </Field>
                  )}
                  {errorMsg && !["invalid_phone", "weak_password", "invalid_email"].includes(error ?? "") && <Alert tone="red">{errorMsg}</Alert>}
                  <Button type="submit" block size="lg" loading={busy} disabled={method === "email" ? !emailValid || !password : !phoneValid || (method === "password" && !password)}>
                    {method === "sms"
                      ? busy
                        ? t("auth.sending")
                        : t("auth.sendOtp")
                      : mode === "signup"
                        ? t("auth.createWithPassword")
                        : t("auth.signInWithPassword")}
                    {!busy && <ArrowRight className="w-5 h-5" />}
                  </Button>
                  {method !== "sms" && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <button type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")} className="font-semibold text-green hover:underline">
                        {mode === "signup" ? t("auth.haveAccountShort") : t("auth.noAccount")}
                      </button>
                      {method === "email" && (
                        <span className="flex gap-3">
                          <button type="button" onClick={magicLink} disabled={!emailValid || busy} className="font-semibold text-green hover:underline disabled:text-charcoal/40">
                            {t("auth.magicLink")}
                          </button>
                          {mode === "login" && (
                            <button type="button" onClick={forgot} disabled={!emailValid || busy} className="font-semibold text-charcoal/60 hover:underline disabled:text-charcoal/30">
                              {t("auth.forgot")}
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="flex items-center justify-center gap-1.5 text-xs text-charcoal/45">
                    <Lock className="w-3.5 h-3.5" /> {t("auth.privacy")}
                  </p>
                </form>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-6 animate-fade-in">
                <button onClick={() => setStep("phone")} className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal/60 hover:text-green">
                  <ArrowLeft className="w-4 h-4" /> {t("auth.changeNumber")}
                </button>
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">{t("auth.verifyTitle")}</h1>
                  <p className="mt-2 text-charcoal/60">{t("auth.codeSentTo", { phone: fullPhone })}</p>
                </div>
                {isMock && (
                  <Alert tone="blue" icon={<Info className="w-4 h-4" />}>
                    {t("auth.demoOtp")}
                  </Alert>
                )}
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void verify();
                  }}
                >
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    aria-label={t("auth.otpPlaceholder")}
                    className="h-16 text-center text-3xl font-bold tracking-[0.6em]"
                    autoFocus
                  />
                  {errorMsg && <Alert tone="red">{errorMsg}</Alert>}
                  <Button type="submit" block size="lg" loading={busy} disabled={otp.length !== 6}>
                    {busy ? t("auth.verifying") : t("auth.verify")}
                  </Button>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={resend}
                      disabled={resendIn > 0 || busy}
                      className="text-sm font-semibold text-green disabled:text-charcoal/40"
                    >
                      {resendIn > 0 ? t("auth.resendIn", { seconds: resendIn }) : t("auth.resend")}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {step === "reset" && (
              <form
                className="space-y-5 animate-fade-in"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveNewPassword();
                }}
              >
                <h1 className="text-3xl font-extrabold tracking-tight">{t("auth.newPasswordTitle")}</h1>
                <Field label={t("auth.password")} hint={t("auth.passwordHint", { min: MIN_PASSWORD })} htmlFor="new-password">
                  <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                </Field>
                {errorMsg && <Alert tone="red">{errorMsg}</Alert>}
                <Button type="submit" block size="lg" loading={busy}>
                  {t("common.save")}
                </Button>
              </form>
            )}

            {step === "profile" && (
              <form
                className="space-y-5 animate-fade-in"
                onSubmit={(e) => {
                  e.preventDefault();
                  void finish();
                }}
              >
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight">{t("auth.profileTitle")}</h1>
                  <p className="mt-2 text-charcoal/60">{t("auth.profileSubtitle")}</p>
                </div>
                <Field label={t("auth.accountType")}>
                  <div className="grid grid-cols-3 gap-2" role="radiogroup">
                    {ROLES.map(({ role: r, icon: Icon }) => (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={role === r}
                        onClick={() => setRole(r)}
                        className={cx(
                          "flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 text-xs font-bold transition",
                          role === r ? "border-green bg-green text-white" : "border-grey bg-white text-charcoal hover:border-green/40",
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        {t(`roles.${r}.label`)}
                      </button>
                    ))}
                  </div>
                </Field>
                {role && role !== "customer" && (
                  <Alert tone="orange" icon={<Info className="w-4 h-4" />}>
                    {t("auth.verificationNotice")}
                  </Alert>
                )}
                <Field label={role === "business" ? t("auth.contactName") : t("auth.fullName")} htmlFor="name" error={error === "name_required" ? errorMsg : null}>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder={t("auth.fullNamePlaceholder")} />
                </Field>
                <Field label={t("auth.email")} optional optionalLabel={t("common.optional")} htmlFor="email" error={error === "invalid_email" ? errorMsg : null}>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="nom@exemple.cm" />
                </Field>
                <Field label={t("auth.city")} htmlFor="city">
                  <Select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
                    {CITIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
                <label className="flex items-start gap-3 text-sm text-charcoal/70">
                  <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#087C55]" />
                  <span>{t("auth.terms")}</span>
                </label>
                {errorMsg && !["name_required", "invalid_email"].includes(error ?? "") && <Alert tone="red">{errorMsg}</Alert>}
                <Button type="submit" block size="lg" variant="accent" loading={busy}>
                  {role && role !== "customer" ? t("auth.continueToOnboarding") : t("auth.createAccount")}
                </Button>
                <p className="text-center text-xs text-charcoal/45">
                  <Link href={`/${locale}`} className="font-semibold text-green hover:underline">
                    {t("common.backHome")}
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
