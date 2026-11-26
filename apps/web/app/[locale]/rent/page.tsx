"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck, CalendarDays, CircleCheck, Hourglass, KeyRound, Users, X } from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Toggle, cx } from "@/components/ui/primitives";
import { VEHICLE_ICON } from "@/components/ui/brand";
import { useAuth } from "@/lib/auth";
import { ApiError, createRentalRequest, getRentalRequest, getRentals } from "@/lib/api";
import type { RentalRequest, RentalVehicle } from "@/lib/mock-store";
import { formatDate, formatXAF, todayISO } from "@/lib/format";

const TYPES = ["all", "car", "van", "truck", "moto", "tricycle"] as const;

function days(start: string, end: string) {
  if (!start || !end) return 0;
  const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
  return d > 0 ? d : 0;
}

export default function RentPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { session, user, profile, signInAnonymous } = useAuth();
  const [vehicles, setVehicles] = useState<RentalVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<RentalVehicle | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<RentalRequest | null>(null);

  useEffect(() => {
    setProviderFilter(new URLSearchParams(window.location.search).get("provider"));
    getRentals()
      .then(setVehicles)
      .catch(() => setVehicles([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name);
      setPhone(profile.phone);
    }
  }, [profile]);

  const requestId = request?.id;
  useEffect(() => {
    if (!requestId) return;
    const id = setInterval(() => getRentalRequest(requestId).then(setRequest).catch(() => undefined), 3000);
    return () => clearInterval(id);
  }, [requestId]);

  const list = useMemo(
    () => vehicles.filter((v) => (type === "all" ? true : v.type === type)).filter((v) => (providerFilter ? v.provider_id === providerFilter : true)),
    [vehicles, type, providerFilter],
  );
  const nDays = days(start, end);

  const open = (v: RentalVehicle) => {
    setSelected(v);
    setWithDriver(v.with_driver);
    setError(null);
    const today = todayISO();
    setStart(today);
    setEnd(today);
  };

  const submit = async () => {
    if (!selected) return;
    if (!start || !end || nDays === 0) return setError(t("rent.invalidDates"));
    if (!name.trim() || phone.replace(/\D/g, "").length < 8) return setError(t("rent.contactRequired"));
    setBusy(true);
    setError(null);
    try {
      let uid = user?.id ?? null;
      if (!session) uid = (await signInAnonymous()).userId ?? null;
      const r = await createRentalRequest({
        vehicle_id: selected.id,
        customer_user_id: uid,
        customer_name: name.trim(),
        phone: phone.trim(),
        start_date: start,
        end_date: end,
        with_driver: withDriver,
      });
      setRequest(r);
      setSelected(null);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? t("rent.unavailable") : t("common.networkError"));
    } finally {
      setBusy(false);
    }
  };

  if (request) {
    const confirmed = request.status === "confirmed" || request.status === "active";
    const declined = request.status === "declined" || request.status === "cancelled";
    return (
      <AppShell title={t("rent.title")} back="/rent">
        <Card className="mx-auto max-w-md p-6 text-center">
          <span
            className={cx(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white",
              confirmed ? "bg-green" : declined ? "bg-charcoal/40" : "bg-orange",
            )}
          >
            {confirmed ? <CircleCheck className="w-8 h-8" /> : declined ? <X className="w-8 h-8" /> : <Hourglass className="w-8 h-8" />}
          </span>
          <h1 className="mt-4 text-xl font-extrabold">{t(`rent.statusTitle.${request.status}`)}</h1>
          <p className="mt-1 text-sm text-charcoal/60">{t(`rent.statusHint.${request.status}`)}</p>
          <div className="mt-5 rounded-2xl bg-ivory p-4 text-left text-sm space-y-1">
            <p className="font-bold">{request.vehicle_label}</p>
            <p className="text-charcoal/60">
              {formatDate(request.start_date, locale)} → {formatDate(request.end_date, locale)}
            </p>
            <p className="text-charcoal/60">{request.with_driver ? t("rent.withDriver") : t("rent.noDriver")}</p>
            <div className="flex justify-between border-t border-grey pt-2 mt-2">
              <span>{t("rent.total")}</span>
              <span className="font-extrabold text-green">{formatXAF(request.total_xaf, locale)}</span>
            </div>
            <div className="flex justify-between text-charcoal/55">
              <span>{t("rent.deposit")}</span>
              <span>{formatXAF(request.deposit_xaf, locale)}</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setRequest(null)}>
              {t("rent.newRequest")}
            </Button>
            <Button href={`/${locale}/trips?tab=rentals`}>{t("rent.myRentals")}</Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("rent.title")} wide>
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-forest to-green p-6 text-white">
          <KeyRound className="absolute -right-4 -bottom-6 h-40 w-40 text-white/10" aria-hidden />
          <p className="relative text-2xl font-extrabold text-white">{t("rent.headline")}</p>
          <p className="relative mt-1 max-w-lg text-sm text-white/75">{t("rent.subtitle")}</p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {TYPES.map((ty) => (
            <button
              key={ty}
              onClick={() => setType(ty)}
              aria-pressed={type === ty}
              className={cx(
                "shrink-0 rounded-full px-4 h-10 text-sm font-bold transition",
                type === ty ? "bg-green text-white" : "bg-white border border-grey text-charcoal/70 hover:border-green/40",
              )}
            >
              {ty === "all" ? t("directory.all") : t(`rentalTypes.${ty}`)}
            </button>
          ))}
          {providerFilter && (
            <button onClick={() => setProviderFilter(null)} className="shrink-0 inline-flex items-center gap-1 rounded-full bg-forest px-4 h-10 text-sm font-bold text-white">
              {vehicles.find((v) => v.provider_id === providerFilter)?.provider_name ?? "…"} <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-56 rounded-3xl bg-white animate-shimmer" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Card>
            <EmptyState icon={<KeyRound className="w-6 h-6" />} title={t("rent.empty")} />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((v) => {
              const Icon = VEHICLE_ICON[v.type] ?? KeyRound;
              return (
                <Card key={v.id} className="overflow-hidden flex flex-col">
                  <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-ivory to-grey/60">
                    {v.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Icon className="h-16 w-16 text-green/70" />
                    )}
                    <Badge tone="forest" className="absolute left-3 top-3">
                      {t(`rentalTypes.${v.type}`)}
                    </Badge>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-extrabold">
                      {v.brand} {v.model}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-charcoal/55">
                      <BadgeCheck className="w-3.5 h-3.5 text-green" /> {v.provider_name}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-charcoal/65">
                      {v.seats && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-ivory px-2 py-0.5">
                          <Users className="w-3 h-3" /> {t("rent.seats", { count: v.seats })}
                        </span>
                      )}
                      <span className="rounded-full bg-ivory px-2 py-0.5">{v.with_driver ? t("rent.withDriver") : t("rent.noDriver")}</span>
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-4">
                      <div>
                        <p className="text-lg font-extrabold text-green">
                          {formatXAF(v.price_per_day_xaf, locale)}
                          <span className="text-xs font-semibold text-charcoal/50"> {t("common.perDay")}</span>
                        </p>
                        <p className="text-xs text-charcoal/50">
                          {formatXAF(v.price_per_hour_xaf, locale)} {t("common.perHour")}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => open(v)}>
                        {t("rent.request")}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.brand} ${selected.model}` : ""} closeLabel={t("common.close")}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("rent.startDate")}>
                <Input type="date" value={start} min={todayISO()} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label={t("rent.endDate")}>
                <Input type="date" value={end} min={start || todayISO()} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
            <Field label={t("rent.name")}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label={t("rent.phone")}>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6…" />
            </Field>
            <Toggle checked={withDriver} onChange={setWithDriver} label={t("rent.withDriver")} />
            <div className="rounded-2xl bg-ivory p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="inline-flex items-center gap-1 text-charcoal/60">
                  <CalendarDays className="w-4 h-4" /> {t("rent.days", { count: nDays })}
                </span>
                <span className="font-extrabold text-green">{formatXAF(nDays * selected.price_per_day_xaf, locale)}</span>
              </div>
              <div className="flex justify-between text-charcoal/55">
                <span>{t("rent.deposit")}</span>
                <span>{formatXAF(selected.deposit_xaf, locale)}</span>
              </div>
            </div>
            {error && <Alert tone="red">{error}</Alert>}
            <Button block size="lg" variant="accent" onClick={submit} loading={busy}>
              {t("rent.submit")}
            </Button>
            <p className="text-center text-xs text-charcoal/50">{t("rent.pendingHint")}</p>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
