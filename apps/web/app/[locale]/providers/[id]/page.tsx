"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck, Building2, Clock, Lock, MessageCircle, Phone, Star } from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import { Avatar, Badge, Button, Card, EmptyState, PageLoader, SectionTitle } from "@/components/ui/primitives";
import { ServiceIcon, VEHICLE_ICON } from "@/components/ui/brand";
import { useAuth } from "@/lib/auth";
import { getProviderOffers, getPublicProvider, type ProviderOffers } from "@/lib/api";
import type { PublicProvider } from "@/lib/mock-store";
import { formatDate, formatXAF, whatsappLink } from "@/lib/format";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ProviderPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations();
  const locale = useLocale();
  const { session, isAnonymous, loading } = useAuth();
  const registered = !!session && !isAnonymous;
  const [basic, setBasic] = useState<PublicProvider | null | undefined>(undefined);
  const [offers, setOffers] = useState<ProviderOffers | null>(null);

  useEffect(() => {
    getPublicProvider(id).then(setBasic).catch(() => setBasic(null));
  }, [id]);

  useEffect(() => {
    if (!registered) return;
    getProviderOffers(id).then(setOffers).catch(() => setOffers(null));
  }, [id, registered]);

  if (basic === undefined || loading) return <PageLoader label={t("common.loading")} />;
  if (basic === null) {
    return (
      <AppShell back="/directory">
        <Card>
          <EmptyState title={t("providerPage.notFound")} />
        </Card>
      </AppShell>
    );
  }

  const p = offers?.provider ?? basic;
  const isRider = p.kind === "rider";
  const VIcon = VEHICLE_ICON[p.vehicle?.type ?? "car"];
  const signInHref = `/${locale}/auth?next=${encodeURIComponent(`/${locale}/providers/${id}`)}`;
  const bookHref = isRider && p.vehicle ? `/${locale}?vehicle=${p.vehicle.type}` : p.services.includes("rent") ? `/${locale}/rent?provider=${p.id}` : `/${locale}/express`;

  return (
    <AppShell back="/directory" title={p.display_name}>
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-green to-forest" aria-hidden />
          <div className="-mt-10 flex flex-wrap items-end gap-4 px-5 pb-5">
            {isRider ? (
              <Avatar name={p.display_name} src={p.photo} size={84} className="ring-4 ring-white" />
            ) : (
              <span className="flex h-[84px] w-[84px] items-center justify-center rounded-3xl bg-forest text-white ring-4 ring-white">
                <Building2 className="w-9 h-9" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-10">
              <h1 className="flex items-center gap-2 text-2xl font-extrabold">
                <span className="truncate">{p.display_name}</span>
                <BadgeCheck className="w-5 h-5 shrink-0 text-green" aria-label={t("directory.verified")} />
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-charcoal/60">
                <Badge tone={p.is_online ? "green" : "grey"} dot>
                  {p.is_online ? t("directory.online") : t("directory.offline")}
                </Badge>
                <span className="inline-flex items-center gap-1 font-bold text-orange">
                  <Star className="w-4 h-4 fill-orange" /> {p.rating_count ? p.rating_avg.toFixed(1) : t("directory.new")}
                </span>
                {p.rating_count > 0 && <span>({p.rating_count})</span>}
                <span>· {t("providerPage.trips", { count: p.trips_completed })}</span>
              </div>
            </div>
            <Button href={bookHref} variant="accent" className="w-full sm:w-auto">
              {isRider ? t("directory.book") : p.services.includes("rent") ? t("directory.seeFleet") : t("directory.sendParcel")}
            </Button>
          </div>
          {isRider && p.vehicle && (
            <div className="mx-5 mb-5 flex items-center gap-3 rounded-2xl bg-ivory p-3 text-sm">
              <VIcon className="w-5 h-5 text-green" />
              <span className="font-semibold">
                {t(`vehicleTypes.${p.vehicle.type}`)} · {p.vehicle.brand} {p.vehicle.model} · {p.vehicle.color}
              </span>
            </div>
          )}
          {p.bio && <p className="px-5 pb-5 text-sm text-charcoal/70">{p.bio}</p>}
        </Card>

        {!registered ? (
          <Card className="p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green/10 text-green">
              <Lock className="w-6 h-6" />
            </span>
            <p className="mt-3 text-lg font-extrabold">{t("providerPage.lockedTitle")}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-charcoal/60">{t("providerPage.lockedHint")}</p>
            <Button href={signInHref} className="mt-5">
              {t("providerPage.signIn")}
            </Button>
          </Card>
        ) : !offers ? (
          <PageLoader />
        ) : (
          <>
            {(p.phone || p.whatsapp) && (
              <div className="grid grid-cols-2 gap-3">
                {p.phone && (
                  <Button href={`tel:${p.phone}`} variant="soft" size="lg">
                    <Phone className="w-5 h-5" /> {t("common.call")}
                  </Button>
                )}
                {p.whatsapp && (
                  <Button href={whatsappLink(p.whatsapp, t("directory.whatsappText"))} variant="soft" size="lg">
                    <MessageCircle className="w-5 h-5" /> WhatsApp
                  </Button>
                )}
              </div>
            )}
            {!p.phone && <p className="text-center text-xs text-charcoal/50">{t("directory.appOnly")}</p>}

            <Card className="p-5">
              <SectionTitle>{t("onboard.steps.services")}</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                {(p.service_details.length ? p.service_details : p.services.map((s) => ({ type: s, base_price_xaf: 0, zones: [] as string[] }))).map((s) => (
                  <div key={s.type} className="flex items-center gap-3 rounded-2xl border border-grey p-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10 text-green">
                      <ServiceIcon service={s.type} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold">GoBert {t(`services.${s.type}.name`)}</p>
                      <p className="truncate text-xs text-charcoal/55">
                        {s.base_price_xaf > 0 ? t("profile.from", { price: formatXAF(s.base_price_xaf, locale) }) : ""}
                        {s.zones.length ? ` · ${s.zones.join(", ")}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-sm text-charcoal/65">
                <Clock className="w-4 h-4 text-green" />
                {p.schedule.is_24h
                  ? t("onboard.fields.is24h")
                  : `${DAY_ORDER.filter((d) => p.schedule.days.includes(d)).map((d) => t(`days.${d}`)).join(" · ")} — ${p.schedule.start}–${p.schedule.end}`}
              </p>
            </Card>

            {offers.fleet.length > 0 && (
              <Card className="p-5">
                <SectionTitle>{t("dashboard.business.tabs.fleet")}</SectionTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  {offers.fleet.map((v) => {
                    const Icon = VEHICLE_ICON[v.type] ?? VIcon;
                    return (
                      <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-grey p-3">
                        <Icon className="w-6 h-6 text-green" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">
                            {v.brand} {v.model}
                          </p>
                          <p className="text-xs text-charcoal/55">{v.with_driver ? t("rent.withDriver") : t("rent.noDriver")}</p>
                        </div>
                        <p className="text-sm font-extrabold text-green">
                          {formatXAF(v.price_per_day_xaf, locale)}
                          <span className="text-xs font-normal text-charcoal/50"> {t("common.perDay")}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
                <Button href={`/${locale}/rent?provider=${p.id}`} block className="mt-4">
                  {t("rent.request")}
                </Button>
              </Card>
            )}

            <Card className="p-5">
              <SectionTitle>{t("providerPage.reviews")}</SectionTitle>
              {offers.reviews.length === 0 ? (
                <p className="text-sm text-charcoal/50">{t("providerPage.noReviews")}</p>
              ) : (
                <ul className="divide-y divide-grey/70">
                  {offers.reviews.map((r, i) => (
                    <li key={i} className="py-3">
                      <p className="flex items-center gap-1 text-sm font-bold text-orange">
                        {Array.from({ length: r.stars }).map((_, j) => (
                          <Star key={j} className="w-3.5 h-3.5 fill-orange" />
                        ))}
                        <span className="ml-2 text-xs font-normal text-charcoal/45">{formatDate(r.at, locale)}</span>
                      </p>
                      {r.comment && <p className="mt-1 text-sm text-charcoal/75">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
