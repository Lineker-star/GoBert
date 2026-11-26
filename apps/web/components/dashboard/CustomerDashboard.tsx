"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarDays, ChevronRight, MapPin, Package, Search, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getCustomerRentals, getPassengerBookings, getPublicProviders, getSenderParcels } from "@/lib/api";
import { usePolling } from "@/hooks/useAccount";
import { formatDate, formatXAF } from "@/lib/format";
import { Alert, Badge, Button, Card, EmptyState, STATUS_TONE, SectionTitle, cx } from "@/components/ui/primitives";
import { ServiceIcon } from "@/components/ui/brand";

const TILES = [
  { key: "moto", href: "/map?vehicle=moto", tone: "bg-green text-white" },
  { key: "ride", href: "/map?vehicle=taxi", tone: "bg-forest text-white" },
  { key: "express", href: "/express", tone: "bg-orange text-white" },
  { key: "cargo", href: "/map?vehicle=truck", tone: "bg-green text-white" },
  { key: "rent", href: "/rent", tone: "bg-forest text-white" },
  { key: "logistics", href: "/directory?service=logistics", tone: "bg-green text-white" },
] as const;

const ACTIVE = ["requested", "accepted", "arriving", "in_progress"];

export default function CustomerDashboard() {
  const t = useTranslations();
  const locale = useLocale();
  const { user, profile, isAnonymous } = useAuth();
  const uid = user?.id ?? null;
  const L = (p: string) => `/${locale}${p}`;

  const loadBookings = useCallback(() => (uid ? getPassengerBookings(uid) : Promise.resolve([])), [uid]);
  const loadRentals = useCallback(() => (uid ? getCustomerRentals(uid) : Promise.resolve([])), [uid]);
  const loadParcels = useCallback(() => (uid ? getSenderParcels(uid) : Promise.resolve([])), [uid]);
  const loadOnline = useCallback(() => getPublicProviders({ online: true }), []);

  const { value: bookings } = usePolling(loadBookings, 10_000, []);
  const { value: rentals } = usePolling(loadRentals, 15_000, []);
  const { value: parcels } = usePolling(loadParcels, 15_000, []);
  const { value: online } = usePolling(loadOnline, 30_000, []);

  const active = bookings.find((b) => ACTIVE.includes(b.status));
  const firstName = profile?.full_name.split(" ")[0];

  const recent = useMemo(() => {
    const items = [
      ...bookings.map((b) => ({
        id: b.id,
        at: b.created_at,
        icon: b.vehicle_type === "moto" ? "moto" : b.vehicle_type === "truck" ? "cargo" : "ride",
        title: `${b.pickup.label} → ${b.dropoff.label}`,
        amount: b.fare_final_xaf ?? b.fare_estimate_xaf,
        status: b.status,
        href: L(`/booking?id=${b.id}`),
      })),
      ...rentals.map((r) => ({
        id: r.id,
        at: r.created_at,
        icon: "rent",
        title: r.vehicle_label,
        amount: r.total_xaf,
        status: r.status,
        href: L("/trips?tab=rentals"),
      })),
      ...parcels.map((p) => ({
        id: p.id,
        at: p.created_at,
        icon: "express",
        title: `${p.sender_name} → ${p.receiver_name}`,
        amount: p.fare_xaf,
        status: p.status,
        href: L(`/express?id=${p.id}`),
      })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, rentals, parcels, locale]);

  const onlineByService = (s: string) => online.filter((p) => p.services.includes(s as never)).length;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-sm text-charcoal/55">
            <MapPin className="w-4 h-4 text-green" /> {profile?.city ?? "Bertoua"}, Cameroun
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
            {firstName ? t("dashboard.hello", { name: firstName }) : t("dashboard.helloGuest")}
          </h1>
        </div>
      </div>

      {isAnonymous && (
        <Alert
          tone="orange"
          icon={<Sparkles className="w-4 h-4" />}
          title={t("dashboard.customer.guestTitle")}
          action={
            <Button href={L("/auth?role=customer")} size="sm" variant="accent">
              {t("dashboard.customer.guestCta")}
            </Button>
          }
        >
          {t("dashboard.customer.guestHint")}
        </Alert>
      )}

      {/* Promo hero */}
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-green to-forest text-white">
        <div className="relative z-10 max-w-[60%] p-6 sm:p-8">
          <p className="text-xl sm:text-3xl font-extrabold leading-tight text-white">{t("dashboard.customer.promoTitle")}</p>
          <p className="mt-2 text-sm text-white/75 hidden sm:block">{t("dashboard.customer.promoSubtitle")}</p>
          <Button href={L("/map")} size="sm" className="mt-5 bg-white !text-forest hover:bg-ivory">
            {t("dashboard.customer.promoCta")} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 w-[48%]">
          <Image src="/brand/driver.webp" alt="" fill sizes="(min-width: 1024px) 420px, 50vw" className="object-cover object-[30%_center]" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-green via-green/40 to-transparent" aria-hidden />
        </div>
      </div>

      {/* Where to */}
      <Link
        href={L("/map")}
        className="flex items-center gap-3 rounded-2xl border border-grey bg-white px-4 h-14 shadow-sm transition hover:border-green/50"
      >
        <Search className="w-5 h-5 text-green" />
        <span className="flex-1 text-[15px] font-semibold text-charcoal/50">{t("dashboard.customer.whereTo")}</span>
        <span className="rounded-xl bg-orange px-3 py-1.5 text-xs font-bold text-white">{t("dashboard.customer.go")}</span>
      </Link>

      {/* Active trip */}
      {active && (
        <Link href={L(`/booking?id=${active.id}`)}>
          <Card className="flex items-center gap-4 p-4 border-green/40 bg-green/5 hover:shadow-md transition">
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-green text-white">
              <ServiceIcon service={active.vehicle_type === "moto" ? "moto" : "ride"} />
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-orange ring-2 ring-white animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-green">{t("dashboard.customer.activeTrip")}</p>
              <p className="truncate text-sm font-bold">{active.dropoff.label}</p>
              <p className="text-xs text-charcoal/55">{t(`booking.status.${active.status}`)}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-charcoal/40" />
          </Card>
        </Link>
      )}

      {/* Services */}
      <section>
        <SectionTitle>{t("dashboard.customer.services")}</SectionTitle>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {TILES.map((tile) => {
            const count = onlineByService(tile.key);
            return (
              <Link
                key={tile.key}
                href={L(tile.href)}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-grey bg-white p-3 pt-4 text-center transition hover:-translate-y-0.5 hover:border-green/40 hover:shadow-md"
              >
                <span className={cx("flex h-12 w-12 items-center justify-center rounded-full shadow-sm", tile.tone)}>
                  <ServiceIcon service={tile.key} className="w-6 h-6" />
                </span>
                <span className="text-sm font-bold">{t(`services.${tile.key}.name`)}</span>
                <span className="text-[11px] text-charcoal/45">{count > 0 ? t("dashboard.customer.onlineCount", { count }) : " "}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent */}
        <section>
          <SectionTitle
            action={
              uid && (
                <Link href={L("/trips")} className="text-sm font-semibold text-green hover:underline">
                  {t("common.seeAll")}
                </Link>
              )
            }
          >
            {t("dashboard.customer.recent")}
          </SectionTitle>
          <Card>
            {recent.length === 0 ? (
              <EmptyState icon={<CalendarDays className="w-6 h-6" />} title={t("dashboard.customer.noTrips")} description={t("dashboard.customer.noTripsHint")} />
            ) : (
              <ul className="divide-y divide-grey/70">
                {recent.map((r) => (
                  <li key={r.id}>
                    <Link href={r.href} className="flex items-center gap-3 p-4 hover:bg-ivory/60">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10 text-green">
                        <ServiceIcon service={r.icon} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{r.title}</p>
                        <p className="text-xs text-charcoal/50">{formatDate(r.at, locale, true)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatXAF(r.amount, locale)}</p>
                        <Badge tone={STATUS_TONE[r.status] ?? "grey"}>{t(`status.${r.status}`)}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        {/* Directory & express promo */}
        <section className="space-y-3">
          <SectionTitle>{t("dashboard.customer.explore")}</SectionTitle>
          <Link href={L("/directory")}>
            <Card className="flex items-center gap-4 p-4 hover:shadow-md transition">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest text-white">
                <Users className="w-6 h-6" />
              </span>
              <div className="flex-1">
                <p className="font-bold">{t("dashboard.customer.directoryTitle")}</p>
                <p className="text-sm text-charcoal/55">{t("dashboard.customer.directoryHint", { count: online.length })}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-charcoal/40" />
            </Card>
          </Link>
          <Link href={L("/express")} className="block">
            <Card className="flex items-center gap-4 p-4 hover:shadow-md transition">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange text-white">
                <Package className="w-6 h-6" />
              </span>
              <div className="flex-1">
                <p className="font-bold">{t("dashboard.customer.expressTitle")}</p>
                <p className="text-sm text-charcoal/55">{t("dashboard.customer.expressHint")}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-charcoal/40" />
            </Card>
          </Link>
          <div className="relative overflow-hidden rounded-3xl">
            <Image src="/brand/riders-group.webp" alt="" width={500} height={419} className="h-36 w-full object-cover" sizes="(min-width: 1024px) 380px, 100vw" />
            <div className="absolute inset-0 bg-gradient-to-t from-forest/90 to-transparent" />
            <p className="absolute bottom-3 left-4 right-4 text-sm font-bold text-white">{t("dashboard.customer.verifiedNote")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
