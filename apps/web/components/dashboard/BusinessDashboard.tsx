"use client";
import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Banknote, BadgeCheck, CalendarDays, ClipboardList, Eye, EyeOff, KeyRound, Package, Phone, Plus, Trash2, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAccount, usePolling } from "@/hooks/useAccount";
import {
  addFleetVehicle,
  getProviderParcels,
  getProviderRentals,
  removeFleetVehicle,
  respondRental,
  setRentalStatus,
  updateFleetVehicle,
} from "@/lib/api";
import type { FleetInput, MockProvider, RentalVehicle } from "@/lib/mock-store";
import { formatDate, formatXAF, whatsappLink } from "@/lib/format";
import { Alert, Badge, Button, Card, EmptyState, Modal, PageLoader, STATUS_TONE, SectionTitle, Stat, cx } from "@/components/ui/primitives";
import { ServiceIcon, VEHICLE_ICON } from "@/components/ui/brand";
import { VerificationPanel } from "./VerificationPanel";
import { ExpressJobs } from "./RiderDashboard";
import { EMPTY_FLEET, FleetForm } from "./FleetForm";

type Tab = "requests" | "fleet" | "deliveries";

export default function BusinessDashboard() {
  const t = useTranslations();
  const locale = useLocale();
  const { profile } = useAuth();
  const { account, loading, refresh } = useAccount(profile?.id, 15_000);
  const provider = account?.provider ?? null;

  if (loading && !account) return <PageLoader label={t("common.loading")} />;

  if (!provider) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Heading name={profile?.full_name} />
        <Card className="p-6">
          <p className="text-lg font-extrabold">{t("dashboard.business.finishTitle")}</p>
          <p className="mt-1 text-sm text-charcoal/60">{t("dashboard.business.finishHint")}</p>
          <Button href={`/${locale}/onboard`} variant="accent" className="mt-5">
            {account?.draft ? t("dashboard.rider.continueOnboarding") : t("dashboard.rider.startOnboarding")}
          </Button>
        </Card>
      </div>
    );
  }

  const approved = provider.verification_status === "approved";
  const canEdit = provider.verification_status === "changes_requested" || provider.verification_status === "rejected";

  return (
    <div className="space-y-6">
      <Heading name={provider.display_name} approved={approved} />
      {!approved && <VerificationPanel provider={provider} onEdit={canEdit ? () => (window.location.href = `/${locale}/onboard`) : undefined} />}
      <BusinessWorkspace provider={provider} fleet={account?.fleet ?? []} approved={approved} onChange={refresh} />
    </div>
  );
}

function Heading({ name, approved }: { name?: string | null; approved?: boolean }) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-charcoal/55">{t("roles.business.label")}</p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{name}</h1>
      </div>
      {approved && (
        <Badge tone="green" className="!text-sm !px-3 !py-1">
          <BadgeCheck className="w-4 h-4" /> {t("dashboard.business.visible")}
        </Badge>
      )}
    </div>
  );
}

function BusinessWorkspace({ provider, fleet, approved, onChange }: { provider: MockProvider; fleet: RentalVehicle[]; approved: boolean; onChange: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const { profile } = useAuth();
  const offersExpress = provider.services.includes("express");
  const [tab, setTab] = useState<Tab>("requests");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FleetInput>(EMPTY_FLEET);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadRequests = useCallback(() => getProviderRentals(provider.id), [provider.id]);
  const { value: requests, refresh: refreshRequests } = usePolling(loadRequests, 6_000, []);
  const loadParcels = useCallback(() => getProviderParcels(provider.id), [provider.id]);
  const { value: parcels, refresh: refreshParcels } = usePolling(offersExpress && approved ? loadParcels : null, 6_000, []);

  const stats = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "requested").length,
      active: requests.filter((r) => r.status === "confirmed" || r.status === "active").length,
      deliveries: parcels.filter((p) => p.provider_id === provider.id && p.status !== "delivered").length,
    }),
    [requests, parcels, provider.id],
  );

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    await fn().catch(() => undefined);
    setBusy(null);
    void refreshRequests();
    onChange();
  };

  const saveVehicle = async () => {
    if (!form.brand.trim() || !form.model.trim() || form.plate.trim().length < 4 || !(form.price_per_day_xaf > 0)) {
      setFormError(t("fleet.formError"));
      return;
    }
    setBusy("add");
    try {
      await addFleetVehicle(provider.id, profile!.id, form);
      setAdding(false);
      setForm(EMPTY_FLEET);
      setFormError(null);
      onChange();
    } catch {
      setFormError(t("common.networkError"));
    } finally {
      setBusy(null);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { key: "requests", label: t("dashboard.business.tabs.requests"), icon: ClipboardList, count: stats.pending },
    { key: "fleet", label: t("dashboard.business.tabs.fleet"), icon: KeyRound, count: fleet.length },
    ...(offersExpress ? [{ key: "deliveries" as Tab, label: t("dashboard.business.tabs.deliveries"), icon: Package, count: stats.deliveries }] : []),
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("dashboard.business.stats.pending")} value={stats.pending} icon={<ClipboardList className="w-5 h-5" />} tone="orange" />
        <Stat label={t("dashboard.business.stats.active")} value={stats.active} icon={<CalendarDays className="w-5 h-5" />} />
        <Stat label={t("dashboard.business.stats.fleet")} value={fleet.length} icon={<Truck className="w-5 h-5" />} tone="forest" />
        <Stat label={t("dashboard.business.stats.revenue")} value={formatXAF(provider.earnings_xaf, locale)} icon={<Banknote className="w-5 h-5" />} />
      </div>

      <Card className="p-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-charcoal/45 mr-1">{t("dashboard.business.services")}</span>
        {provider.services.map((s) => (
          <Badge key={s} tone="green">
            <ServiceIcon service={s} className="w-3.5 h-3.5" /> {t(`services.${s}.name`)}
          </Badge>
        ))}
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 h-10 text-sm font-bold transition",
              tab === key ? "bg-forest text-white" : "bg-white border border-grey text-charcoal/70 hover:border-green/40",
            )}
          >
            <Icon className="w-4 h-4" /> {label}
            {!!count && <span className={cx("rounded-full px-1.5 text-[11px]", tab === key ? "bg-white/20" : "bg-charcoal/5")}>{count}</span>}
          </button>
        ))}
      </div>

      {tab === "requests" && (
        <Card>
          {!approved && (
            <div className="p-4 pb-0">
              <Alert tone="blue">{t("dashboard.business.hiddenUntilApproved")}</Alert>
            </div>
          )}
          {requests.length === 0 ? (
            <EmptyState icon={<ClipboardList className="w-6 h-6" />} title={t("dashboard.business.noRequests")} description={t("dashboard.business.noRequestsHint")} />
          ) : (
            <ul className="divide-y divide-grey/70">
              {requests.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{r.vehicle_label}</p>
                      <p className="text-sm text-charcoal/60">
                        {r.customer_name} · {formatDate(r.start_date, locale)} → {formatDate(r.end_date, locale)}
                      </p>
                      <p className="text-xs text-charcoal/50">
                        {r.with_driver ? t("rent.withDriver") : t("rent.noDriver")} · {t("rent.deposit")} {formatXAF(r.deposit_xaf, locale)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-green">{formatXAF(r.total_xaf, locale)}</p>
                      <Badge tone={STATUS_TONE[r.status] ?? "grey"}>{t(`status.${r.status}`)}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status !== "declined" && r.status !== "cancelled" && (
                      <>
                        <Button href={`tel:${r.phone}`} variant="outline" size="sm">
                          <Phone className="w-4 h-4" /> {t("common.call")}
                        </Button>
                        <Button href={whatsappLink(r.phone)} variant="outline" size="sm">
                          WhatsApp
                        </Button>
                      </>
                    )}
                    {r.status === "requested" && (
                      <>
                        <Button size="sm" variant="danger" loading={busy === r.id + "d"} onClick={() => act(r.id + "d", () => respondRental(r.id, false, provider.id))}>
                          {t("dashboard.business.decline")}
                        </Button>
                        <Button size="sm" loading={busy === r.id} onClick={() => act(r.id, () => respondRental(r.id, true, provider.id))}>
                          {t("dashboard.business.confirm")}
                        </Button>
                      </>
                    )}
                    {r.status === "confirmed" && (
                      <Button size="sm" loading={busy === r.id} onClick={() => act(r.id, () => setRentalStatus(r.id, provider.id, "active"))}>
                        {t("dashboard.business.handOver")}
                      </Button>
                    )}
                    {r.status === "active" && (
                      <Button size="sm" variant="accent" loading={busy === r.id} onClick={() => act(r.id, () => setRentalStatus(r.id, provider.id, "completed"))}>
                        {t("dashboard.business.returned")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "fleet" && (
        <section>
          <SectionTitle
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="w-4 h-4" /> {t("fleet.add")}
              </Button>
            }
          >
            {t("dashboard.business.tabs.fleet")}
          </SectionTitle>
          {fleet.length === 0 ? (
            <Card>
              <EmptyState icon={<KeyRound className="w-6 h-6" />} title={t("dashboard.business.noFleet")} description={t("dashboard.business.noFleetHint")} />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fleet.map((v) => {
                const Icon = VEHICLE_ICON[v.type] ?? KeyRound;
                return (
                  <Card key={v.id} className={cx("p-4", !v.available && "opacity-70")}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green/10 text-green">
                        <Icon className="w-6 h-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">
                          {v.brand} {v.model}
                        </p>
                        <p className="text-xs text-charcoal/55">
                          {v.plate} · {t(`rentalTypes.${v.type}`)} {v.seats ? `· ${t("rent.seats", { count: v.seats })}` : ""}
                        </p>
                        <p className="mt-1 text-sm font-bold text-green">
                          {formatXAF(v.price_per_day_xaf, locale)} <span className="font-normal text-charcoal/50">{t("common.perDay")}</span>
                        </p>
                      </div>
                      <Badge tone={v.available && approved ? "green" : "grey"}>{v.available ? (approved ? t("fleet.listed") : t("fleet.awaiting")) : t("fleet.hidden")}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        loading={busy === v.id}
                        onClick={() => act(v.id, () => updateFleetVehicle(provider.id, profile!.id, v.id, { available: !v.available }))}
                      >
                        {v.available ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {v.available ? t("fleet.hide") : t("fleet.show")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => act(v.id + "x", () => removeFleetVehicle(provider.id, profile!.id, v.id))}>
                        <Trash2 className="w-4 h-4" /> {t("common.remove")}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "deliveries" && offersExpress && (
        approved ? (
          <ExpressJobs providerId={provider.id} parcels={parcels} onChange={refreshParcels} />
        ) : (
          <Card className="p-5">
            <Alert tone="blue">{t("dashboard.business.hiddenUntilApproved")}</Alert>
          </Card>
        )
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title={t("fleet.addTitle")} closeLabel={t("common.close")}>
        <div className="space-y-4">
          <FleetForm value={form} onChange={setForm} />
          {formError && <Alert tone="red">{formError}</Alert>}
          <Button block size="lg" loading={busy === "add"} onClick={saveVehicle}>
            {t("fleet.save")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
