"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck, Building2, Clock, Lock, MessageCircle, Phone, Search, Star, Users } from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import { Avatar, Badge, Button, Card, EmptyState, Input, Toggle, cx } from "@/components/ui/primitives";
import { ServiceIcon } from "@/components/ui/brand";
import { getDirectoryProviders, type DirectoryProvider } from "@/lib/booking-api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { formatXAF, whatsappLink } from "@/lib/format";
import type { ServiceKey } from "@/lib/mock-store";

const FILTERS: (ServiceKey | "all")[] = ["all", "moto", "ride", "express", "cargo", "rent", "logistics"];
const CACHE_KEY = "gobert:directory";

/** True when the provider's schedule covers "now" in Africa/Douala. */
function openNow(p: DirectoryProvider): boolean {
  if (p.schedule.is_24h) return true;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Douala", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.find((x) => x.type === "weekday")?.value ?? "");
  const hm = `${parts.find((x) => x.type === "hour")?.value}:${parts.find((x) => x.type === "minute")?.value}`;
  return p.schedule.days.includes(wd) && hm >= p.schedule.start && hm <= p.schedule.end;
}

export default function DirectoryPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [providers, setProviders] = useState<DirectoryProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [filter, setFilter] = useState<ServiceKey | "all">("all");
  const [query, setQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("service") as ServiceKey | null;
    if (s && FILTERS.includes(s)) setFilter(s);
    getDirectoryProviders()
      .then((list) => {
        setProviders(list);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(list));
        } catch {
          // storage full
        }
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            setProviders(JSON.parse(raw));
            setFromCache(true);
          }
        } catch {
          // ignore
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return providers
      .filter((p) => (filter === "all" ? true : p.services.includes(filter)))
      .filter((p) => (onlineOnly ? p.is_online : true))
      .filter((p) => !q || p.display_name.toLowerCase().includes(q) || p.vehicle?.plate.toLowerCase().includes(q))
      .sort((a, b) => Number(b.is_online) - Number(a.is_online) || b.rating_avg - a.rating_avg);
  }, [providers, filter, query, onlineOnly]);

  return (
    <AppShell title={t("directory.title")} wide>
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-forest p-6 text-white">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-green/40 blur-2xl" aria-hidden />
          <p className="relative flex items-center gap-2 text-sm font-semibold text-orange">
            <BadgeCheck className="w-4 h-4" /> {t("directory.verifiedOnly")}
          </p>
          <p className="relative mt-1 text-2xl font-extrabold text-white">{t("directory.headline")}</p>
          <p className="relative mt-1 max-w-xl text-sm text-white/70">{t("directory.subtitle")}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("directory.search")} className="pl-10" />
          </div>
          <Toggle checked={onlineOnly} onChange={setOnlineOnly} label={t("directory.onlineOnly")} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 h-10 text-sm font-bold transition",
                filter === f ? "bg-green text-white shadow-sm shadow-green/25" : "bg-white border border-grey text-charcoal/70 hover:border-green/40",
              )}
            >
              {f !== "all" && <ServiceIcon service={f} className="w-4 h-4" />}
              {f === "all" ? t("directory.all") : t(`services.${f}.name`)}
            </button>
          ))}
        </div>

        {fromCache && <p className="text-xs text-orange">{t("offline.banner")}</p>}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 rounded-3xl bg-white animate-shimmer" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState icon={<Users className="w-6 h-6" />} title={t("directory.empty")} />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <ProviderCard key={p.id} p={p} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ProviderCard({ p, locale }: { p: DirectoryProvider; locale: string }) {
  const t = useTranslations();
  const { session, isAnonymous } = useAuth();
  const registered = !!session && !isAnonymous;
  const profileHref = `/${locale}/providers/${p.id}`;
  const open = openNow(p);
  const minPrice = Math.min(...(p.service_details.length ? p.service_details.map((s) => s.base_price_xaf) : [0]));
  const isRider = p.kind === "rider";
  const bookHref = isRider && p.vehicle ? `/${locale}?vehicle=${p.vehicle.type}` : p.services.includes("rent") ? `/${locale}/rent?provider=${p.id}` : `/${locale}/express`;

  return (
    <Card className="flex min-w-0 flex-col p-4">
      <div className="flex items-start gap-3">
        {isRider ? (
          <Avatar name={p.display_name} src={p.photo} size={52} />
        ) : (
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-forest text-white">
            <Building2 className="w-6 h-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={profileHref} className="flex items-center gap-1 font-extrabold hover:text-green">
            <span className="truncate">{p.display_name}</span>
            <BadgeCheck className="w-4 h-4 shrink-0 text-green" aria-label={t("directory.verified")} />
          </Link>
          <p className="truncate text-xs text-charcoal/55">
            {isRider && p.vehicle
              ? `${t(`vehicleTypes.${p.vehicle.type}`)} · ${p.vehicle.brand} ${p.vehicle.model}`
              : p.business
                ? t(`businessTypes.${p.business.type}.name`)
                : ""}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-0.5 font-bold text-orange">
              <Star className="w-3.5 h-3.5 fill-orange" /> {p.rating_count ? p.rating_avg.toFixed(1) : t("directory.new")}
            </span>
            {p.rating_count > 0 && <span className="text-charcoal/45">({p.rating_count})</span>}
          </div>
        </div>
        <Badge tone={p.is_online ? "green" : "grey"} dot>
          {p.is_online ? t("directory.online") : t("directory.offline")}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.services.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-ivory px-2.5 py-1 text-[11px] font-semibold text-charcoal/70">
            <ServiceIcon service={s} className="w-3.5 h-3.5 text-green" /> {t(`services.${s}.name`)}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-charcoal/55">
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {p.schedule.is_24h ? "24/7" : `${p.schedule.start}–${p.schedule.end}`}
          <span className={cx("ml-1 font-semibold", open ? "text-green" : "text-charcoal/45")}>· {open ? t("directory.openNow") : t("directory.closed")}</span>
        </span>
        {minPrice > 0 && <span className="font-bold text-charcoal">{t("profile.from", { price: formatXAF(minPrice, locale) })}</span>}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button href={bookHref} size="sm" className="min-w-[8rem] flex-1" variant={isRider ? "primary" : "dark"}>
          {isRider ? t("directory.book") : p.services.includes("rent") ? t("directory.seeFleet") : t("directory.sendParcel")}
        </Button>
        {registered ? (
          <>
            <Button href={profileHref} size="sm" variant="outline">
              {t("directory.details")}
            </Button>
            {p.phone ? (
              <Button href={`tel:${p.phone}`} size="sm" variant="outline" aria-label={t("common.call")}>
                <Phone className="w-4 h-4" />
              </Button>
            ) : null}
            {p.whatsapp ? (
              <Button href={whatsappLink(p.whatsapp, t("directory.whatsappText"))} size="sm" variant="outline" aria-label="WhatsApp">
                <MessageCircle className="w-4 h-4" />
              </Button>
            ) : null}
          </>
        ) : (
          <Button href={`/${locale}/auth?next=${encodeURIComponent(profileHref)}`} size="sm" variant="outline">
            <Lock className="w-4 h-4" /> {t("directory.signInToContact")}
          </Button>
        )}
      </div>
      {registered && !p.phone && <p className="mt-2 text-[11px] text-charcoal/45">{t("directory.appOnly")}</p>}
    </Card>
  );
}
