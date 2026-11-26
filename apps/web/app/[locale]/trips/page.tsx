"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, ChevronRight, KeyRound, Package, Star } from "lucide-react";
import AppShell, { RequireAuth } from "@/components/ui/AppShell";
import { Badge, Button, Card, EmptyState, STATUS_TONE, cx } from "@/components/ui/primitives";
import { ServiceIcon } from "@/components/ui/brand";
import { useAuth } from "@/lib/auth";
import { useAccount, usePolling } from "@/hooks/useAccount";
import { cancelRental, getCustomerRentals, getPassengerBookings, getProviderBookings, getSenderParcels } from "@/lib/api";
import { formatDate, formatKm, formatXAF } from "@/lib/format";

type Tab = "rides" | "rentals" | "parcels";

export default function TripsPage() {
  const t = useTranslations();
  return (
    <RequireAuth allowGuest roles={["customer", "rider"]}>
      <AppShell title={t("trips.title")}>
        <Trips />
      </AppShell>
    </RequireAuth>
  );
}

function Trips() {
  const { role } = useAuth();
  return role === "rider" ? <RiderHistory /> : <CustomerTrips />;
}

function CustomerTrips() {
  const t = useTranslations();
  const locale = useLocale();
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const [tab, setTab] = useState<Tab>("rides");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q === "rentals" || q === "parcels" || q === "rides") setTab(q);
  }, []);

  const lb = useCallback(() => getPassengerBookings(uid), [uid]);
  const lr = useCallback(() => getCustomerRentals(uid), [uid]);
  const lp = useCallback(() => getSenderParcels(uid), [uid]);
  const bookings = usePolling(lb, 10_000, []);
  const rentals = usePolling(lr, 10_000, []);
  const parcels = usePolling(lp, 10_000, []);

  const tabs: { key: Tab; icon: React.ElementType; count: number }[] = [
    { key: "rides", icon: CalendarDays, count: bookings.value.length },
    { key: "rentals", icon: KeyRound, count: rentals.value.length },
    { key: "parcels", icon: Package, count: parcels.value.length },
  ];

  const cancel = async (id: string) => {
    setBusy(id);
    await cancelRental(id, uid).catch(() => undefined);
    setBusy(null);
    void rentals.refresh();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white border border-grey p-1" role="tablist">
        {tabs.map(({ key, icon: Icon, count }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx("flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition", tab === key ? "bg-green text-white" : "text-charcoal/60 hover:bg-charcoal/5")}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t(`trips.tabs.${key}`)}</span>
            <span className="sm:hidden">{t(`trips.tabsShort.${key}`)}</span>
            {count > 0 && <span className={cx("rounded-full px-1.5 text-[11px]", tab === key ? "bg-white/20" : "bg-charcoal/5")}>{count}</span>}
          </button>
        ))}
      </div>

      {tab === "rides" && (
        <Card>
          {bookings.value.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-6 h-6" />}
              title={t("trips.emptyRides")}
              action={<Button href={`/${locale}/map`} variant="accent">{t("landing.ctaBook")}</Button>}
            />
          ) : (
            <ul className="divide-y divide-grey/70">
              {bookings.value.map((b) => (
                <li key={b.id}>
                  <Link href={`/${locale}/booking?id=${b.id}`} className="flex items-center gap-3 p-4 hover:bg-ivory/60">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green/10 text-green">
                      <ServiceIcon service={b.vehicle_type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{b.dropoff.label}</p>
                      <p className="truncate text-xs text-charcoal/55">
                        {t("trips.from", { place: b.pickup.label })} · {formatKm(b.distance_m, locale)}
                      </p>
                      <p className="text-xs text-charcoal/45">
                        {formatDate(b.created_at, locale, true)}
                        {b.provider ? ` · ${b.provider.display_name}` : ""}
                        {b.rating ? ` · ${b.rating}★` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold">{formatXAF(b.fare_final_xaf ?? b.fare_estimate_xaf, locale)}</p>
                      <Badge tone={STATUS_TONE[b.status] ?? "grey"}>{t(`status.${b.status}`)}</Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-charcoal/30" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "rentals" && (
        <Card>
          {rentals.value.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="w-6 h-6" />}
              title={t("trips.emptyRentals")}
              action={<Button href={`/${locale}/rent`}>{t("nav.rent")}</Button>}
            />
          ) : (
            <ul className="divide-y divide-grey/70">
              {rentals.value.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{r.vehicle_label}</p>
                      <p className="text-sm text-charcoal/60">
                        {formatDate(r.start_date, locale)} → {formatDate(r.end_date, locale)} · {r.with_driver ? t("rent.withDriver") : t("rent.noDriver")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold">{formatXAF(r.total_xaf, locale)}</p>
                      <Badge tone={STATUS_TONE[r.status] ?? "grey"}>{t(`status.${r.status}`)}</Badge>
                    </div>
                  </div>
                  {(r.status === "requested" || r.status === "confirmed") && (
                    <Button variant="ghost" size="sm" className="mt-2 !px-0 text-red-600" loading={busy === r.id} onClick={() => cancel(r.id)}>
                      {t("trips.cancelRental")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "parcels" && (
        <Card>
          {parcels.value.length === 0 ? (
            <EmptyState
              icon={<Package className="w-6 h-6" />}
              title={t("trips.emptyParcels")}
              action={<Button href={`/${locale}/express`} variant="accent">{t("express.send")}</Button>}
            />
          ) : (
            <ul className="divide-y divide-grey/70">
              {parcels.value.map((p) => (
                <li key={p.id}>
                  <Link href={`/${locale}/express?id=${p.id}`} className="flex items-center gap-3 p-4 hover:bg-ivory/60">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange/15 text-[#B25E0B]">
                      <Package className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{p.receiver_name}</p>
                      <p className="truncate text-xs text-charcoal/55">
                        {p.pickup.label} → {p.dropoff.label}
                      </p>
                      <p className="text-xs text-charcoal/45">{formatDate(p.created_at, locale, true)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold">{formatXAF(p.fare_xaf, locale)}</p>
                      <Badge tone={STATUS_TONE[p.status] ?? "grey"}>{t(`status.${p.status}`)}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function RiderHistory() {
  const t = useTranslations();
  const locale = useLocale();
  const { profile } = useAuth();
  const { account } = useAccount(profile?.id);
  const pid = account?.provider?.id ?? null;
  const load = useCallback(() => (pid ? getProviderBookings(pid) : Promise.resolve([])), [pid]);
  const { value: trips } = usePolling(pid ? load : null, 15_000, []);
  const done = trips.filter((b) => b.status === "completed");
  const total = done.reduce((s, b) => s + (b.fare_final_xaf ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-charcoal/55">{t("trips.completed")}</p>
          <p className="text-2xl font-extrabold">{done.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-charcoal/55">{t("trips.earned")}</p>
          <p className="text-2xl font-extrabold text-green">{formatXAF(total, locale)}</p>
        </Card>
      </div>
      <Card>
        {trips.length === 0 ? (
          <EmptyState icon={<CalendarDays className="w-6 h-6" />} title={t("dashboard.rider.noTrips")} description={t("dashboard.rider.noTripsHint")} />
        ) : (
          <ul className="divide-y divide-grey/70">
            {trips.map((b) => (
              <li key={b.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {b.pickup.label} → {b.dropoff.label}
                  </p>
                  <p className="text-xs text-charcoal/50">
                    {formatDate(b.created_at, locale, true)} · {t(`payments.${b.payment_method}`)}
                  </p>
                  {b.rating_comment && <p className="mt-1 text-xs italic text-charcoal/60">“{b.rating_comment}”</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{formatXAF(b.fare_final_xaf ?? b.fare_estimate_xaf, locale)}</p>
                  {b.rating ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-orange">
                      <Star className="w-3 h-3 fill-orange" /> {b.rating}
                    </span>
                  ) : (
                    <Badge tone={STATUS_TONE[b.status] ?? "grey"}>{t(`status.${b.status}`)}</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
