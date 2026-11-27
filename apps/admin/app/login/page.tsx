"use client";
import { asset } from "@/lib/asset";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { supabase, USE_MOCKS, checkAdminSession, adminSignOut } from "@/lib/supabase";

type Step = "password" | "enroll" | "verify";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

/**
 * supabase-js returns the QR code as `data:image/svg+xml;utf-8,<svg …>` with the SVG
 * not URL-encoded. A "#" (colour) or "%" in the markup then truncates the URL and the
 * image renders empty, so re-encode it.
 */
function qrDataUrl(raw: string): string {
  if (!raw) return raw;
  const svg = raw.startsWith("<") ? raw : raw.replace(/^data:image\/svg\+xml;(?:utf-8|charset=utf-8),/i, "");
  if (!svg.trimStart().startsWith("<")) return raw; // already base64 / encoded
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Admin sign-in: email + password, then a 6-digit code from an authenticator app
 * (Supabase TOTP). First-time admins enrol by scanning a QR code. Finally the
 * database must confirm the admin role for this aal2 session.
 */
export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  // Resume: already past password but not 2FA?
  useEffect(() => {
    checkAdminSession().then(async (s) => {
      if (s === "ok") router.replace("/overview");
      else if (s === "mfa") await prepareMfa();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fail = (msg: string) => {
    const n = attempts + 1;
    setAttempts(n);
    if (n >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCK_MS);
      setAttempts(0);
      setError("Trop de tentatives. Réessayez dans une minute.");
    } else setError(msg);
  };

  async function prepareMfa() {
    const { data, error: err } = await supabase.auth.mfa.listFactors();
    if (err) return setError(err.message);
    const verified = data.totp.find((f) => f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setStep("verify");
      return;
    }
    // Clean up half-finished enrolments, then enrol a fresh authenticator.
    for (const f of data.all.filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data: en, error: enErr } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `GoBert Admin ${new Date().toISOString().slice(0, 10)}` });
    if (enErr) return setError(enErr.message);
    setFactorId(en.id);
    setQr(qrDataUrl(en.totp.qr_code));
    setSecret(en.totp.secret);
    setStep("enroll");
  }

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Date.now() < lockedUntil) return setError("Trop de tentatives. Réessayez dans une minute.");
    setBusy(true);
    setError(null);
    if (USE_MOCKS) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_WEB_API_URL ?? "http://localhost:3000"}/api/mock/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      }).catch(() => null);
      setBusy(false);
      if (!res?.ok) return fail("Identifiants invalides.");
      sessionStorage.setItem("gobert:admin-mock", "1");
      return router.replace("/overview");
    }
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (err) {
      setBusy(false);
      return fail("Identifiants invalides.");
    }
    await prepareMfa();
    setBusy(false);
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) return setError("Saisissez le code à 6 chiffres.");
    if (Date.now() < lockedUntil) return setError("Trop de tentatives. Réessayez dans une minute.");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (err) {
      setBusy(false);
      setCode("");
      return fail("Code incorrect ou expiré.");
    }
    const status = await checkAdminSession();
    setBusy(false);
    if (status !== "ok") {
      await adminSignOut();
      setStep("password");
      setPassword("");
      setCode("");
      return setError("Accès refusé : ce compte n'est pas administrateur.");
    }
    router.replace("/overview");
  };

  const input = "w-full h-12 rounded-xl border border-grey bg-white px-4 text-[15px] focus:outline-none focus:border-green focus:ring-4 focus:ring-green/10";
  const button = "flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-green text-sm font-bold text-white hover:bg-green-dark disabled:opacity-50";

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-end bg-forest p-12 text-white">
        <Image src={asset("/logo-full-white.png")} alt="GoBert" width={640} height={202} className="h-12 w-auto self-start" />
        <p className="mt-6 text-3xl font-extrabold">Console d&apos;administration</p>
        <p className="mt-2 max-w-md text-white/70">Accès protégé : mot de passe + code d&apos;application d&apos;authentification (2FA). Toutes les actions sont journalisées.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <Image src={asset("/logo-full.png")} alt="GoBert" width={640} height={202} className="h-10 w-auto self-start lg:hidden" />
          {USE_MOCKS && <p className="rounded-xl bg-orange/15 px-3 py-2 text-xs font-semibold text-[#B25E0B]">Mode démo : aucune donnée réelle, 2FA désactivée. Ne jamais utiliser en production.</p>}

          {step === "password" && (
            <form onSubmit={submitPassword} className="space-y-4">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold">
                  <Lock className="w-5 h-5 text-green" /> Connexion administrateur
                </h1>
                <p className="mt-1 text-sm text-charcoal/55">Étape 1 sur 2 — identifiants.</p>
              </div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" autoComplete="username" required className={input} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" required className={input} />
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy} className={button}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Continuer
              </button>
            </form>
          )}

          {step === "enroll" && (
            <form onSubmit={submitCode} className="space-y-4">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold">
                  <Smartphone className="w-5 h-5 text-green" /> Activer la 2FA
                </h1>
                <p className="mt-1 text-sm text-charcoal/55">Scannez ce QR code avec Google Authenticator, Microsoft Authenticator ou Authy, puis saisissez le code affiché.</p>
              </div>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR code 2FA" className="mx-auto h-52 w-52 rounded-xl border border-grey bg-white p-2" />
              )}
              {secret && (
                <p className="break-all rounded-xl bg-ivory p-3 text-center font-mono text-xs">
                  Clé manuelle : <span className="font-bold">{secret}</span>
                </p>
              )}
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Code à 6 chiffres" className={`${input} text-center text-2xl tracking-[0.4em] font-bold`} autoFocus />
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy || code.length !== 6} className={button}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Activer et se connecter
              </button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={submitCode} className="space-y-4">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold">
                  <ShieldCheck className="w-5 h-5 text-green" /> Vérification 2FA
                </h1>
                <p className="mt-1 text-sm text-charcoal/55">Étape 2 sur 2 — saisissez le code de votre application d&apos;authentification.</p>
                <p className="mt-2 rounded-xl bg-ivory px-3 py-2 text-xs text-charcoal/60">
                  Ce compte a déjà une application d&apos;authentification enregistrée (entrée « GoBert » dans Google Authenticator, Authy…), donc aucun QR code n&apos;est affiché. Application perdue ? Un autre administrateur, ou le propriétaire de la base Supabase, doit réinitialiser la 2FA de ce compte ; un nouveau QR code apparaîtra à la connexion suivante.
                </p>
              </div>
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" className={`${input} h-16 text-center text-3xl tracking-[0.5em] font-bold`} autoFocus />
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy || code.length !== 6} className={button}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Vérifier
              </button>
              <button
                type="button"
                onClick={async () => {
                  await adminSignOut();
                  setStep("password");
                }}
                className="w-full text-sm font-semibold text-charcoal/55 hover:text-charcoal"
              >
                Annuler
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
