"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  Clock,
  FileText,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  WifiOff,
  Bike,
  Building2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button, cx } from "@/components/ui/primitives";
import { ServiceIcon } from "@/components/ui/brand";
import AppShell from "@/components/ui/AppShell";
import { InstallAppButton } from "@/components/pwa/InstallApp";

const SERVICES = ["moto", "ride", "express", "cargo", "rent", "logistics"] as const;

function Dot() {
  return <span className="text-orange">.</span>;
}

export default function PartnersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { session, signInAnonymous } = useAuth();
  const [guestBusy, setGuestBusy] = useState(false);
  const L = (p: string) => `/${locale}${p}`;

  const continueAsGuest = async () => {
    setGuestBusy(true);
    if (!session) await signInAnonymous();
    router.push(L("/map"));
  };

  const audiences = [
    {
      key: "customer",
      img: "/brand/moto-traffic.webp",
      icon: UserRound,
      accent: "bg-green",
    },
    {
      key: "rider",
      img: "/brand/riders-group.webp",
      icon: Bike,
      accent: "bg-orange",
    },
    {
      key: "business",
      img: "/brand/driver.webp",
      icon: Building2,
      accent: "bg-forest",
    },
  ] as const;

  const values = [
    { key: "safe", icon: ShieldCheck },
    { key: "local", icon: HeartHandshake },
    { key: "lowData", icon: WifiOff },
    { key: "fast", icon: Clock },
  ] as const;

  return (
    <AppShell wide>
    <div className="-mx-4 -mt-5 text-charcoal">
      {/* ---------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden rounded-b-[2rem]">
        <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-green/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -right-20 h-[420px] w-[420px] rounded-full bg-orange/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-14 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-20">
          <div className="animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-green/20 bg-white px-3 py-1.5 text-xs font-semibold text-green shadow-sm">
              <MapPin className="w-3.5 h-3.5" /> {t("landing.badge")}
            </span>
            <h1 className="mt-5 text-[2.6rem] leading-[1.05] font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Move<Dot /> <span className="text-green">Connect</span>
              <Dot /> Go<Dot />
            </h1>
            <p className="mt-5 max-w-xl text-base sm:text-lg text-charcoal/70 leading-relaxed">{t("landing.heroSubtitle")}</p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Button href={L("/map")} variant="accent" size="lg" className="sm:w-auto">
                {t("landing.ctaBook")} <ArrowRight className="w-5 h-5" />
              </Button>
              <Button href={L("/auth")} variant="outline" size="lg">
                {t("landing.ctaCreate")}
              </Button>
            </div>
            {!session && (
              <button
                onClick={continueAsGuest}
                disabled={guestBusy}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-charcoal/60 hover:text-green disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-green" /> {t("landing.ctaGuest")}
              </button>
            )}
            <dl className="mt-9 grid grid-cols-3 gap-4 max-w-md">
              {(["services", "verified", "languages"] as const).map((k) => (
                <div key={k}>
                  <dt className="text-2xl font-extrabold text-forest">{t(`landing.stats.${k}.value`)}</dt>
                  <dd className="text-xs text-charcoal/55 leading-snug">{t(`landing.stats.${k}.label`)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative animate-fade-in-up stagger-2">
            <div className="relative overflow-hidden rounded-[2rem] shadow-2xl shadow-forest/20 ring-1 ring-black/5">
              <Image
                src="/brand/hero-scene.webp"
                alt={t("landing.heroImageAlt")}
                width={1400}
                height={429}
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="h-[320px] sm:h-[420px] w-full object-cover object-[38%_center]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest/50 via-transparent to-transparent" aria-hidden />
            </div>
            <div className="absolute -bottom-5 left-4 sm:-left-6 flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-xl animate-float">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green text-white">
                <ServiceIcon service="ride" />
              </span>
              <div>
                <p className="text-sm font-bold">GoBert Ride</p>
                <p className="text-xs text-charcoal/55">{t("landing.floatEta")}</p>
              </div>
            </div>
            <div className="absolute -top-4 right-4 sm:-right-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-lg">
              <BadgeCheck className="w-4 h-4 text-green" />
              <span className="text-xs font-bold">{t("landing.floatVerified")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- services */}
      <section id="services" className="scroll-mt-20 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-wider text-orange">{t("landing.servicesEyebrow")}</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">{t("landing.servicesTitle")}</h2>
            <p className="mt-3 text-charcoal/65">{t("landing.servicesSubtitle")}</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SERVICES.map((s, i) => (
              <Link
                key={s}
                href={L(s === "rent" ? "/rent" : s === "express" ? "/express" : s === "logistics" || s === "cargo" ? "/directory?service=" + s : "/map?service=" + s)}
                className="group rounded-3xl border border-grey bg-ivory/60 p-5 transition hover:-translate-y-0.5 hover:border-green/40 hover:bg-white hover:shadow-lg"
              >
                <span
                  className={cx(
                    "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md transition group-hover:scale-105",
                    i % 3 === 1 ? "bg-forest" : i === 2 ? "bg-orange" : "bg-green",
                  )}
                >
                  <ServiceIcon service={s} className="w-6 h-6" />
                </span>
                <p className="mt-4 font-bold">GoBert {t(`services.${s}.name`)}</p>
                <p className="mt-1 text-xs leading-relaxed text-charcoal/60">{t(`services.${s}.desc`)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- audiences */}
      <section id="join" className="scroll-mt-20 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-bold uppercase tracking-wider text-orange">{t("landing.audienceEyebrow")}</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">{t("landing.audienceTitle")}</h2>
            <p className="mt-3 text-charcoal/65">{t("landing.audienceSubtitle")}</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {audiences.map(({ key, img, icon: Icon, accent }) => (
              <article key={key} className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-grey bg-white shadow-sm transition hover:shadow-xl">
                <div className="relative h-44 overflow-hidden">
                  <Image src={img} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                  <span className={cx("absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg", accent)}>
                    <Icon className="w-5 h-5" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-charcoal/45">{t(`roles.${key}.label`)}</p>
                  <h3 className="mt-1 text-xl font-extrabold">{t(`roles.${key}.title`)}</h3>
                  <p className="mt-2 text-sm text-charcoal/65">{t(`roles.${key}.desc`)}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {[1, 2, 3].map((n) => (
                      <li key={n} className="flex items-start gap-2">
                        <CircleCheck className="mt-0.5 w-4 h-4 shrink-0 text-green" />
                        <span>{t(`roles.${key}.point${n}`)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-6">
                    <Button href={L(`/auth?role=${key}`)} variant={key === "customer" ? "primary" : key === "rider" ? "accent" : "dark"} block>
                      {t(`roles.${key}.cta`)} <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- how / verification */}
      <section id="how" className="scroll-mt-20 bg-forest text-white py-16 sm:py-20 overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-orange">{t("landing.howEyebrow")}</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{t("landing.howTitle")}</h2>
            <p className="mt-3 text-white/70">{t("landing.howSubtitle")}</p>
            <ol className="mt-8 space-y-5">
              {[
                { icon: Smartphone, n: 1 },
                { icon: FileText, n: 2 },
                { icon: BadgeCheck, n: 3 },
              ].map(({ icon: Icon, n }) => (
                <li key={n} className="flex gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange">
                    <Icon className="w-6 h-6" />
                  </span>
                  <div>
                    <p className="font-bold text-white">
                      {n}. {t(`landing.how.step${n}.title`)}
                    </p>
                    <p className="text-sm text-white/65">{t(`landing.how.step${n}.desc`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-green/30 blur-2xl" aria-hidden />
            <div className="relative overflow-hidden rounded-[2rem] ring-1 ring-white/10">
              <Image src="/brand/poster-bertoua.webp" alt={t("landing.posterAlt")} width={1280} height={720} sizes="(min-width: 1024px) 448px, 100vw" className="w-full h-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- values */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {values.map(({ key, icon: Icon }) => (
              <div key={key} className="rounded-3xl bg-white border border-grey p-5">
                <Icon className="w-7 h-7 text-green" />
                <p className="mt-3 font-bold">{t(`landing.values.${key}.title`)}</p>
                <p className="mt-1 text-sm text-charcoal/60">{t(`landing.values.${key}.desc`)}</p>
              </div>
            ))}
          </div>

          <InstallAppButton variant="card" className="mt-10" />

          <div className="relative mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-green to-forest p-8 sm:p-12 text-white">
            <div className="absolute -right-10 -bottom-16 h-64 w-64 rounded-full bg-orange/30 blur-2xl" aria-hidden />
            <div className="relative max-w-xl">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{t("landing.finalTitle")}</h2>
              <p className="mt-3 text-white/80">{t("landing.finalSubtitle")}</p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Button href={L("/map")} variant="accent" size="lg">
                  {t("landing.ctaBook")}
                </Button>
                <Button href={L("/auth?role=rider")} size="lg" className="bg-white !text-forest hover:bg-ivory">
                  {t("landing.ctaDrive")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
    </AppShell>
  );
}
