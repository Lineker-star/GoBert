"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, Globe, LogOut, MapPin, Phone, Sparkles, Trash2 } from "lucide-react";
import AppShell, { RequireAuth } from "@/components/ui/AppShell";
import { Alert, Avatar, Badge, Button, Card, Field, Input, Select, SectionTitle, Toggle, cx } from "@/components/ui/primitives";
import { ServiceIcon, VEHICLE_ICON } from "@/components/ui/brand";
import { VerificationPanel } from "@/components/dashboard/VerificationPanel";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/hooks/useAccount";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { updateProviderSettings } from "@/lib/api";
import { CITIES } from "@/lib/constants";
import { formatDate, formatXAF } from "@/lib/format";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ProfilePage() {
  return (
    <RequireAuth allowGuest>
      <AppShell title={undefined}>
        <ProfileContent />
      </AppShell>
    </RequireAuth>
  );
}

function ProfileContent() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { profile, isAnonymous, signOut, updateProfile, user } = useAuth();
  const { account, refresh } = useAccount(profile?.id);
  const provider = account?.provider ?? null;
  const { places, remove } = useSavedPlaces(profile?.id ?? null, isAnonymous ? user?.id ?? null : null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("Bertoua");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name);
      setEmail(profile.email ?? "");
      setCity(profile.city);
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError(t("auth.errors.name_required"));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError(t("auth.errors.invalid_email"));
    setSaving(true);
    setError(null);
    const { error: err } = await updateProfile({ full_name: name, email: email || null, city });
    setSaving(false);
    if (err) return setError(t(`auth.errors.${err}`));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    void refresh();
  };

  const changeLanguage = async (lang: "fr" | "en") => {
    if (profile) await updateProfile({ language: lang });
    if (lang !== locale) router.replace(`/${lang}/profile`);
  };

  const doSignOut = async () => {
    await signOut();
    router.replace(`/${locale}`);
  };

  const toggleCalls = async (v: boolean) => {
    if (!provider || !profile) return;
    await updateProviderSettings(provider.id, profile.id, { accepts_direct_calls: v }).catch(() => undefined);
    void refresh();
  };

  if (isAnonymous) {
    return (
      <div className="mx-auto max-w-xl space-y-5">
        <Card className="p-6 text-center">
          <Avatar name="?" size={72} className="mx-auto" />
          <h1 className="mt-4 text-2xl font-extrabold">{t("profile.guestTitle")}</h1>
          <p className="mt-2 text-sm text-charcoal/60">{t("profile.guestHint")}</p>
          <Button href={`/${locale}/auth?role=customer`} variant="accent" className="mt-5">
            <Sparkles className="w-4 h-4" /> {t("profile.createAccount")}
          </Button>
        </Card>
        <LanguageCard onChange={changeLanguage} />
        <Button variant="danger" block onClick={doSignOut}>
          <LogOut className="w-4 h-4" /> {t("profile.endGuest")}
        </Button>
      </div>
    );
  }
  if (!profile) return null;

  const VIcon = VEHICLE_ICON[provider?.vehicle?.type ?? "moto"];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Identity header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-green to-forest" aria-hidden />
        <div className="-mt-10 flex flex-wrap items-end gap-4 px-5 pb-5">
          <Avatar name={profile.full_name} size={84} className="ring-4 ring-white" />
          <div className="min-w-0 flex-1 pt-10">
            <h1 className="text-2xl font-extrabold truncate">{profile.full_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-charcoal/60">
              <Badge tone={profile.role === "customer" ? "green" : profile.role === "rider" ? "orange" : "forest"}>{t(`roles.${profile.role}.label`)}</Badge>
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {profile.phone}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> {t("profile.memberSince", { date: formatDate(profile.created_at, locale) })}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {provider && <VerificationPanel provider={provider} compact onEdit={provider.verification_status === "changes_requested" || provider.verification_status === "rejected" ? () => router.push(`/${locale}/onboard`) : undefined} />}
      {!provider && (profile.role === "rider" || profile.role === "business") && (
        <Alert tone="orange" title={t("profile.applicationMissing")} action={<Button href={`/${locale}/onboard`} size="sm" variant="accent">{t("dashboard.rider.startOnboarding")}</Button>}>
          {t("profile.applicationMissingHint")}
        </Alert>
      )}

      {/* Personal info */}
      <Card className="p-5">
        <SectionTitle>{t("profile.personal")}</SectionTitle>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label={profile.role === "business" ? t("auth.contactName") : t("auth.fullName")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
          <Field label={t("auth.email")} optional optionalLabel={t("common.optional")}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          <Field label={t("auth.city")}>
            <Select value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("auth.phoneLabel")} hint={t("profile.phoneLocked")}>
            <Input value={profile.phone} disabled />
          </Field>
          {error && (
            <div className="sm:col-span-2">
              <Alert tone="red">{error}</Alert>
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" loading={saving}>
              {saved ? t("common.saved") : t("common.save")}
            </Button>
          </div>
        </form>
      </Card>

      {/* Rider vehicle / business details */}
      {provider && (
        <Card className="p-5 space-y-5">
          {provider.kind === "rider" && provider.vehicle && (
            <div>
              <SectionTitle>{t("profile.vehicle")}</SectionTitle>
              <div className="flex items-center gap-4 rounded-2xl bg-ivory p-4">
                {provider.photo?.startsWith("data:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={provider.photo} alt="" className="h-16 w-24 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green text-white">
                    <VIcon className="w-7 h-7" />
                  </span>
                )}
                <div>
                  <p className="font-bold">
                    {provider.vehicle.brand} {provider.vehicle.model}
                    {provider.vehicle.year ? ` (${provider.vehicle.year})` : ""}
                  </p>
                  <p className="text-sm text-charcoal/60">
                    {t(`vehicleTypes.${provider.vehicle.type}`)} · {provider.vehicle.plate} · {provider.vehicle.color}
                  </p>
                </div>
              </div>
            </div>
          )}
          {provider.kind === "business" && provider.business && (
            <div>
              <SectionTitle>{t("profile.business")}</SectionTitle>
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <Info icon={Building2} label={t("onboard.fields.business_name")} value={provider.business.name} />
                <Info icon={Building2} label={t("onboard.fields.business_type")} value={t(`businessTypes.${provider.business.type}.name`)} />
                <Info icon={Building2} label={t("onboard.fields.registration_number")} value={provider.business.registration_number} />
                <Info icon={MapPin} label={t("onboard.fields.address")} value={provider.business.address} />
              </dl>
            </div>
          )}
          <div>
            <SectionTitle>{t("onboard.steps.services")}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {(provider.service_details.length ? provider.service_details : provider.services.map((s) => ({ type: s, base_price_xaf: 0 }))).map((s) => (
                <span key={s.type} className="inline-flex items-center gap-2 rounded-2xl border border-grey bg-white px-3 py-2 text-sm">
                  <ServiceIcon service={s.type} className="w-4 h-4 text-green" />
                  <span className="font-semibold">{t(`services.${s.type}.name`)}</span>
                  {s.base_price_xaf > 0 && <span className="text-charcoal/55">{t("profile.from", { price: formatXAF(s.base_price_xaf, locale) })}</span>}
                </span>
              ))}
            </div>
          </div>
          <div>
            <SectionTitle>{t("onboard.steps.schedule")}</SectionTitle>
            <p className="text-sm text-charcoal/70">
              {provider.schedule.is_24h
                ? t("onboard.fields.is24h")
                : `${DAY_ORDER.filter((d) => provider.schedule.days.includes(d))
                    .map((d) => t(`days.${d}`))
                    .join(" · ")} — ${provider.schedule.start}–${provider.schedule.end}`}
            </p>
          </div>
          <Toggle checked={provider.accepts_direct_calls} onChange={toggleCalls} label={t("onboard.fields.directCalls")} description={t("onboard.fields.directCallsHint")} />
        </Card>
      )}

      {/* Saved places (customers) */}
      {(profile.role === "customer" || profile.role === "admin") && (
        <Card className="p-5">
          <SectionTitle>{t("saved.title")}</SectionTitle>
          {places.length === 0 ? (
            <p className="text-sm text-charcoal/50">{t("saved.empty")}</p>
          ) : (
            <ul className="divide-y divide-grey/70">
              {places.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <MapPin className="w-4 h-4 text-green shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{p.label}</p>
                    {p.address && <p className="truncate text-xs text-charcoal/50">{p.address}</p>}
                  </div>
                  <button onClick={() => remove(p.id)} className="p-2 text-charcoal/35 hover:text-red-600" aria-label={t("common.remove")}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <LanguageCard onChange={changeLanguage} />

      <Button variant="danger" block onClick={doSignOut}>
        <LogOut className="w-4 h-4" /> {t("profile.signOut")}
      </Button>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-ivory p-3">
      <Icon className="w-4 h-4 mt-0.5 text-green shrink-0" />
      <div className="min-w-0">
        <dt className="text-xs text-charcoal/50">{label}</dt>
        <dd className="font-semibold break-words">{value || "—"}</dd>
      </div>
    </div>
  );
}

function LanguageCard({ onChange }: { onChange: (l: "fr" | "en") => void }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <Card className="p-5">
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <Globe className="w-4 h-4 text-green" /> {t("profile.language")}
        </span>
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {(["fr", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => onChange(l)}
            aria-pressed={locale === l}
            className={cx(
              "h-12 rounded-xl border-2 text-sm font-bold transition",
              locale === l ? "border-green bg-green text-white" : "border-grey bg-white text-charcoal hover:border-green/40",
            )}
          >
            {l === "fr" ? "Français" : "English"}
          </button>
        ))}
      </div>
    </Card>
  );
}
