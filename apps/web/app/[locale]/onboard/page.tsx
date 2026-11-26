"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronLeft, ChevronRight, CircleCheck, FileText, Info, Plus, Trash2, Upload, X } from "lucide-react";
import AppShell, { RequireAuth } from "@/components/ui/AppShell";
import { Alert, Badge, Button, Card, Field, Input, PageLoader, Select, Textarea, Toggle, cx } from "@/components/ui/primitives";
import { ServiceIcon, VEHICLE_ICON } from "@/components/ui/brand";
import { VerificationPanel } from "@/components/dashboard/VerificationPanel";
import { FleetForm, EMPTY_FLEET } from "@/components/dashboard/FleetForm";
import { useAuth } from "@/lib/auth";
import { ApiError, getAccount, saveRegistrationDraft, submitRegistration, uploadDocument, type Account } from "@/lib/api";
import { compressImage, formatBytes } from "@/lib/image-compress";
import { formatXAF } from "@/lib/format";
import { CITIES } from "@/lib/constants";
import {
  BUSINESS_DOCS,
  BUSINESS_SERVICES,
  BUSINESS_TYPES,
  DEFAULT_BASE_PRICE,
  RIDER_DOCS,
  RIDER_SERVICES,
  RIDER_VEHICLES,
  type RiderVehicle,
} from "@/lib/domain";
import type { FleetInput, RegistrationData, RegistrationDocument, RegistrationService, ServiceKey } from "@/lib/mock-store";

const RIDER_STEPS = ["about", "vehicle", "documents", "services", "schedule", "review"] as const;
const BUSINESS_STEPS = ["company", "services", "fleet", "documents", "schedule", "review"] as const;
type StepKey = (typeof RIDER_STEPS)[number] | (typeof BUSINESS_STEPS)[number];

const DEFAULT_SCHEDULE = { days: [1, 2, 3, 4, 5, 6], start: "06:00", end: "21:00", is_24h: false };
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function OnboardPage() {
  return (
    <RequireAuth roles={["rider", "business"]}>
      <Onboarding />
    </RequireAuth>
  );
}

function Onboarding() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { profile } = useAuth();
  const kind = profile!.role === "business" ? "business" : "rider";
  const steps: readonly StepKey[] = kind === "business" ? BUSINESS_STEPS : RIDER_STEPS;
  const storageKey = `gobert:onboard:${profile!.id}`;

  const [account, setAccount] = useState<Account | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<RegistrationData>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [consent, setConsent] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  // Load server state (provider + draft), falling back to the local copy when offline.
  useEffect(() => {
    let alive = true;
    getAccount(profile!.id)
      .then((acc) => {
        if (!alive) return;
        setAccount(acc);
        const base: RegistrationData = {
          kind,
          full_name: profile!.full_name,
          phone: profile!.phone,
          city: profile!.city,
          accepts_direct_calls: true,
          schedule: DEFAULT_SCHEDULE,
        };
        let restored: RegistrationData = acc.draft?.data ?? {};
        try {
          const local = JSON.parse(localStorage.getItem(storageKey) ?? "null");
          if (local?.data && (!acc.draft || local.updated_at > acc.draft.updated_at)) restored = local.data;
          if (local?.step != null) setStep(Math.min(local.step, steps.length - 1));
        } catch {
          // ignore corrupt local data
        }
        setData({ ...base, ...restored, kind });
        setDraftId(acc.draft?.id ?? null);
      })
      .catch(() => {
        try {
          const local = JSON.parse(localStorage.getItem(storageKey) ?? "null");
          if (local?.data) setData(local.data);
        } catch {
          setData({ kind, full_name: profile!.full_name, phone: profile!.phone, city: profile!.city });
        }
      })
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [profile, kind, storageKey, steps.length]);

  const update = useCallback(<K extends keyof RegistrationData>(key: K, value: RegistrationData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setErrors((e) => e.filter((x) => x !== key));
  }, []);

  const persist = useCallback(
    async (nextStep: number, nextData: RegistrationData) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ step: nextStep, data: nextData, updated_at: new Date().toISOString() }));
      } catch {
        // storage full (documents) — server draft still saves
      }
      setSaving(true);
      try {
        const d = await saveRegistrationDraft(draftId, profile!.id, nextStep, nextData);
        setDraftId(d.id);
      } catch {
        // offline: local copy kept, will sync on next step
      } finally {
        setSaving(false);
      }
    },
    [draftId, profile, storageKey],
  );

  const validate = (key: StepKey): string[] => {
    const e: string[] = [];
    if (key === "about") {
      if (!data.full_name?.trim()) e.push("full_name");
      if (!data.phone?.trim()) e.push("phone");
    }
    if (key === "vehicle") {
      if (!data.vehicle_type) e.push("vehicle_type");
      if (!data.brand?.trim()) e.push("brand");
      if (!data.model?.trim()) e.push("model");
      if ((data.plate?.trim().length ?? 0) < 4) e.push("plate");
      if (data.year && (data.year < 1980 || data.year > new Date().getFullYear() + 1)) e.push("year");
    }
    if (key === "company") {
      if (!data.business_name?.trim()) e.push("business_name");
      if (!data.business_type) e.push("business_type");
      if (!data.registration_number?.trim()) e.push("registration_number");
      if (!data.address?.trim()) e.push("address");
      if (!data.phone?.trim()) e.push("phone");
    }
    if (key === "documents") {
      const req = (kind === "business" ? BUSINESS_DOCS : RIDER_DOCS).filter((d) => d.required);
      for (const d of req) if (!data.documents?.some((x) => x.type === d.type)) e.push(`doc:${d.type}`);
    }
    if (key === "services") {
      if (!data.services?.length) e.push("services");
      if (data.services?.some((s) => !(s.base_price_xaf > 0))) e.push("price");
    }
    if (key === "schedule") {
      if (!data.schedule?.is_24h && !data.schedule?.days.length) e.push("days");
      if (!data.schedule?.is_24h && data.schedule && data.schedule.start >= data.schedule.end) e.push("hours");
    }
    return e;
  };

  const go = (target: number) => {
    setStep(target);
    void persist(target, data);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const next = () => {
    const e = validate(steps[step]);
    setErrors(e);
    if (e.length) return;
    go(Math.min(steps.length - 1, step + 1));
  };

  const submit = async () => {
    const all = steps.flatMap((s) => validate(s));
    if (all.length) {
      setErrors(all);
      setSubmitError(t("onboard.fixErrors"));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const d = await saveRegistrationDraft(draftId, profile!.id, step, data);
      await submitRegistration(d.id);
      localStorage.removeItem(storageKey);
      const acc = await getAccount(profile!.id);
      setAccount(acc);
      setEditing(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const missing = (e.payload.missing as string[]) ?? [];
        setErrors(missing);
        setSubmitError(t("onboard.fixErrors"));
      } else {
        setSubmitError(t("common.networkError"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) return <PageLoader label={t("common.loading")} />;

  const provider = account?.provider;
  const canEdit = !provider || provider.verification_status === "changes_requested" || provider.verification_status === "rejected";

  // Already submitted: show status instead of the wizard.
  if (provider && (!canEdit || !editing)) {
    return (
      <AppShell title={t(`onboard.title.${kind}`)} back="/dashboard" hideBottomNav>
        <div className="mx-auto max-w-2xl space-y-5">
          <VerificationPanel provider={provider} onEdit={canEdit ? () => setEditing(true) : undefined} />
          <Button href={`/${locale}/dashboard`} block size="lg">
            {t("onboard.goDashboard")}
          </Button>
        </div>
      </AppShell>
    );
  }

  const key = steps[step];
  const progress = ((step + 1) / steps.length) * 100;
  const err = (k: string) => (errors.includes(k) ? t(`onboard.errors.${k.startsWith("doc:") ? "doc" : k}`) : null);

  return (
    <AppShell title={t(`onboard.title.${kind}`)} back="/dashboard" hideBottomNav>
      <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-24">
        {provider?.review_note && (
          <div className="mb-5">
            <Alert tone="orange" title={t("verification.adminNote")} icon={<Info className="w-4 h-4" />}>
              {provider.review_note}
            </Alert>
          </div>
        )}

        {/* Stepper */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs font-semibold text-charcoal/55">
            <span>{t("onboard.stepOf", { current: step + 1, total: steps.length })}</span>
            <span>{saving ? t("onboard.saving") : t("onboard.savedDraft")}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-grey">
            <div className="h-full rounded-full bg-gradient-to-r from-green to-[#0FA36F] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <ol className="mt-4 hidden sm:flex gap-1">
            {steps.map((s, i) => (
              <li key={s} className="flex-1">
                <button
                  type="button"
                  onClick={() => i < step && go(i)}
                  disabled={i > step}
                  className={cx(
                    "w-full rounded-xl px-2 py-2 text-xs font-semibold transition",
                    i === step ? "bg-green text-white" : i < step ? "bg-green/10 text-green hover:bg-green/15" : "bg-white text-charcoal/40 border border-grey",
                  )}
                >
                  {i < step && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                  {t(`onboard.steps.${s}`)}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <Card className="p-5 sm:p-7">
          <h2 className="text-xl font-extrabold">{t(`onboard.steps.${key}`)}</h2>
          <p className="mt-1 mb-6 text-sm text-charcoal/55">{t(`onboard.hints.${key}`)}</p>

          {key === "about" && <AboutStep data={data} update={update} err={err} />}
          {key === "company" && <CompanyStep data={data} update={update} err={err} />}
          {key === "vehicle" && <VehicleStep data={data} update={update} err={err} />}
          {key === "documents" && <DocumentsStep kind={kind} data={data} update={update} errors={errors} />}
          {key === "services" && <ServicesStep kind={kind} data={data} update={update} err={err} />}
          {key === "fleet" && <FleetStep data={data} update={update} />}
          {key === "schedule" && <ScheduleStep data={data} update={update} err={err} />}
          {key === "review" && <ReviewStep kind={kind} data={data} errors={errors} onJump={(s) => go(steps.indexOf(s))} />}

          {key === "review" && (
            <label className="mt-6 flex items-start gap-3 rounded-2xl bg-ivory p-4 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#087C55]" />
              <span>{t("onboard.consent")}</span>
            </label>
          )}
          {submitError && (
            <div className="mt-4">
              <Alert tone="red">{submitError}</Alert>
            </div>
          )}
        </Card>

        <div className="sticky bottom-0 mt-5 flex items-center gap-3 bg-gradient-to-t from-ivory via-ivory to-transparent py-4">
          <Button variant="outline" onClick={() => go(Math.max(0, step - 1))} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4" /> {t("common.back")}
          </Button>
          <div className="flex-1" />
          {key !== "review" ? (
            <Button onClick={next} size="lg">
              {t("common.next")} <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button onClick={submit} variant="accent" size="lg" loading={submitting} disabled={!consent}>
              {provider ? t("onboard.resubmit") : t("onboard.submit")}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ------------------------------------------------------------------ steps

type StepProps = {
  data: RegistrationData;
  update: <K extends keyof RegistrationData>(k: K, v: RegistrationData[K]) => void;
  err: (k: string) => string | null;
};

function AboutStep({ data, update, err }: StepProps) {
  const t = useTranslations();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t("onboard.fields.full_name")} error={err("full_name")}>
        <Input value={data.full_name ?? ""} onChange={(e) => update("full_name", e.target.value)} autoComplete="name" />
      </Field>
      <Field label={t("onboard.fields.phone")} error={err("phone")}>
        <Input value={data.phone ?? ""} onChange={(e) => update("phone", e.target.value)} type="tel" />
      </Field>
      <Field label={t("onboard.fields.whatsapp")} optional optionalLabel={t("common.optional")}>
        <Input value={data.whatsapp ?? ""} onChange={(e) => update("whatsapp", e.target.value)} type="tel" placeholder="+237 6…" />
      </Field>
      <Field label={t("onboard.fields.city")}>
        <Select value={data.city ?? "Bertoua"} onChange={(e) => update("city", e.target.value)}>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("onboard.fields.bio")} optional optionalLabel={t("common.optional")} hint={t("onboard.fields.bioHint")}>
          <Textarea value={data.bio ?? ""} onChange={(e) => update("bio", e.target.value.slice(0, 280))} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Toggle
          checked={data.accepts_direct_calls ?? true}
          onChange={(v) => update("accepts_direct_calls", v)}
          label={t("onboard.fields.directCalls")}
          description={t("onboard.fields.directCallsHint")}
        />
      </div>
    </div>
  );
}

function CompanyStep({ data, update, err }: StepProps) {
  const t = useTranslations();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label={t("onboard.fields.business_name")} error={err("business_name")}>
          <Input value={data.business_name ?? ""} onChange={(e) => update("business_name", e.target.value)} autoComplete="organization" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label={t("onboard.fields.business_type")} error={err("business_type")}>
          <div className="grid grid-cols-2 gap-2">
            {BUSINESS_TYPES.map((bt) => (
              <button
                key={bt}
                type="button"
                onClick={() => update("business_type", bt)}
                className={cx(
                  "rounded-2xl border-2 p-3 text-left transition",
                  data.business_type === bt ? "border-green bg-green/5" : "border-grey bg-white hover:border-green/40",
                )}
              >
                <span className="block text-sm font-bold">{t(`businessTypes.${bt}.name`)}</span>
                <span className="block text-xs text-charcoal/55">{t(`businessTypes.${bt}.desc`)}</span>
              </button>
            ))}
          </div>
        </Field>
      </div>
      <Field label={t("onboard.fields.registration_number")} hint={t("onboard.fields.registrationHint")} error={err("registration_number")}>
        <Input value={data.registration_number ?? ""} onChange={(e) => update("registration_number", e.target.value)} placeholder="RC/BTA/2025/B/123" />
      </Field>
      <Field label={t("onboard.fields.tax_id")} optional optionalLabel={t("common.optional")}>
        <Input value={data.tax_id ?? ""} onChange={(e) => update("tax_id", e.target.value)} placeholder="M0…" />
      </Field>
      <Field label={t("onboard.fields.phone")} error={err("phone")}>
        <Input value={data.phone ?? ""} onChange={(e) => update("phone", e.target.value)} type="tel" />
      </Field>
      <Field label={t("onboard.fields.whatsapp")} optional optionalLabel={t("common.optional")}>
        <Input value={data.whatsapp ?? ""} onChange={(e) => update("whatsapp", e.target.value)} type="tel" />
      </Field>
      <Field label={t("onboard.fields.city")}>
        <Select value={data.city ?? "Bertoua"} onChange={(e) => update("city", e.target.value)}>
          {CITIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </Field>
      <Field label={t("onboard.fields.address")} error={err("address")}>
        <Input value={data.address ?? ""} onChange={(e) => update("address", e.target.value)} placeholder={t("onboard.fields.addressPlaceholder")} />
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("onboard.fields.description")} optional optionalLabel={t("common.optional")}>
          <Textarea value={data.description ?? ""} onChange={(e) => update("description", e.target.value.slice(0, 400))} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Toggle
          checked={data.accepts_direct_calls ?? true}
          onChange={(v) => update("accepts_direct_calls", v)}
          label={t("onboard.fields.directCalls")}
          description={t("onboard.fields.directCallsHint")}
        />
      </div>
    </div>
  );
}

function VehicleStep({ data, update, err }: StepProps) {
  const t = useTranslations();
  const setType = (v: RiderVehicle) => {
    update("vehicle_type", v);
    // keep only services that make sense for the new vehicle
    const allowed = RIDER_SERVICES[v];
    const kept = (data.services ?? []).filter((s) => allowed.includes(s.type));
    update("services", kept.length ? kept : [makeService(allowed[0])]);
  };
  const onPhoto = async (file: File) => {
    const c = await compressImage(file, 150 * 1024, 900);
    update("vehicle_photo", c.dataUrl);
  };
  return (
    <div className="space-y-5">
      <Field label={t("onboard.fields.vehicle_type")} error={err("vehicle_type")}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {RIDER_VEHICLES.map((v) => {
            const Icon = VEHICLE_ICON[v];
            const active = data.vehicle_type === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setType(v)}
                className={cx(
                  "flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition",
                  active ? "border-green bg-green text-white shadow-md shadow-green/20" : "border-grey bg-white hover:border-green/40",
                )}
              >
                <Icon className="w-7 h-7" />
                <span className="text-sm font-bold">{t(`vehicleTypes.${v}`)}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("onboard.fields.brand")} error={err("brand")}>
          <Input value={data.brand ?? ""} onChange={(e) => update("brand", e.target.value)} placeholder="Sanya, Toyota…" />
        </Field>
        <Field label={t("onboard.fields.model")} error={err("model")}>
          <Input value={data.model ?? ""} onChange={(e) => update("model", e.target.value)} />
        </Field>
        <Field label={t("onboard.fields.plate")} error={err("plate")}>
          <Input value={data.plate ?? ""} onChange={(e) => update("plate", e.target.value.toUpperCase())} placeholder="ES 123 AB" />
        </Field>
        <Field label={t("onboard.fields.color")} optional optionalLabel={t("common.optional")}>
          <Input value={data.color ?? ""} onChange={(e) => update("color", e.target.value)} />
        </Field>
        <Field label={t("onboard.fields.year")} optional optionalLabel={t("common.optional")} error={err("year")}>
          <Input type="number" inputMode="numeric" value={data.year ?? ""} onChange={(e) => update("year", Number(e.target.value) || undefined)} />
        </Field>
        {data.vehicle_type === "truck" || data.vehicle_type === "tricycle" ? (
          <Field label={t("onboard.fields.payload_kg")} optional optionalLabel={t("common.optional")}>
            <Input type="number" inputMode="numeric" value={data.payload_kg ?? ""} onChange={(e) => update("payload_kg", Number(e.target.value) || undefined)} />
          </Field>
        ) : (
          <Field label={t("onboard.fields.seats")} optional optionalLabel={t("common.optional")}>
            <Input type="number" inputMode="numeric" value={data.seats ?? ""} onChange={(e) => update("seats", Number(e.target.value) || undefined)} />
          </Field>
        )}
      </div>
      <Field label={t("onboard.fields.vehicle_photo")} optional optionalLabel={t("common.optional")}>
        {data.vehicle_photo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.vehicle_photo} alt="" className="h-20 w-28 rounded-xl object-cover" />
            <Button variant="danger" size="sm" onClick={() => update("vehicle_photo", null)}>
              <X className="w-4 h-4" /> {t("common.remove")}
            </Button>
          </div>
        ) : (
          <UploadBox label={t("onboard.upload")} onFile={onPhoto} icon={<Camera className="w-5 h-5" />} />
        )}
      </Field>
    </div>
  );
}

function UploadBox({ label, onFile, icon }: { label: string; onFile: (f: File) => void; icon?: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-grey bg-ivory/60 px-4 py-5 text-sm font-semibold text-charcoal/60 transition hover:border-green/50 hover:text-green">
      {icon ?? <Upload className="w-5 h-5" />}
      {label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function DocumentsStep({ kind, data, update, errors }: { kind: "rider" | "business"; data: RegistrationData; update: StepProps["update"]; errors: string[] }) {
  const t = useTranslations();
  const docs = data.documents ?? [];
  const defs = kind === "business" ? BUSINESS_DOCS : RIDER_DOCS;
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { profile } = useAuth();

  const onFile = async (type: string, file: File) => {
    setBusy(type);
    setFailed(null);
    try {
      const c = await compressImage(file);
      // Supabase: goes to the private provider-docs bucket; only the path is stored with the application.
      const storage_path = profile ? await uploadDocument(profile.id, type, c.dataUrl) : undefined;
      const doc: RegistrationDocument = { type, name: file.name, size: c.size, data_url: c.dataUrl, storage_path };
      update("documents", [...docs.filter((d) => d.type !== type), doc]);
    } catch {
      setFailed(type);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {defs.map((def) => {
        const existing = docs.find((d) => d.type === def.type);
        const missing = errors.includes(`doc:${def.type}`);
        return (
          <div key={def.type} className={cx("rounded-2xl border-2 p-4 transition", missing ? "border-red-300 bg-red-50/40" : existing ? "border-green/30 bg-green/5" : "border-grey")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", existing ? "bg-green text-white" : "bg-charcoal/5 text-charcoal/50")}>
                  {existing ? <CircleCheck className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </span>
                <div>
                  <p className="text-sm font-bold">{t(`documents.${def.type}`)}</p>
                  <p className="text-xs text-charcoal/50">{def.required ? t("onboard.requiredDoc") : t("common.optional")}</p>
                </div>
              </div>
              {existing && <Badge tone="green">{formatBytes(existing.size)}</Badge>}
            </div>
            <div className="mt-3">
              {existing ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {existing.data_url ? (
                    <img src={existing.data_url} alt={t(`documents.${def.type}`)} className="h-16 w-24 rounded-lg object-cover ring-1 ring-grey" />
                  ) : (
                    <span className="flex h-16 w-24 items-center justify-center rounded-lg bg-green/10 text-green ring-1 ring-grey">
                      <FileText className="w-6 h-6" />
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => update("documents", docs.filter((d) => d.type !== def.type))}>
                    <Trash2 className="w-4 h-4" /> {t("common.remove")}
                  </Button>
                </div>
              ) : busy === def.type ? (
                <p className="text-sm text-charcoal/55">{t("onboard.compressing")}</p>
              ) : (
                <UploadBox label={t("onboard.upload")} onFile={(f) => onFile(def.type, f)} icon={<Camera className="w-5 h-5" />} />
              )}
              {failed === def.type && <p className="mt-2 text-xs text-red-600">{t("onboard.uploadFailed")}</p>}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-charcoal/45">{t("onboard.compressHint")}</p>
    </div>
  );
}

function makeService(type: ServiceKey): RegistrationService {
  return { type, title_fr: type, title_en: type, base_price_xaf: DEFAULT_BASE_PRICE[type], zones: ["Bertoua"] };
}

function ServicesStep({ kind, data, update, err }: StepProps & { kind: "rider" | "business" }) {
  const t = useTranslations();
  const locale = useLocale();
  const allowed: ServiceKey[] = kind === "rider" ? RIDER_SERVICES[(data.vehicle_type as RiderVehicle) ?? "moto"] : BUSINESS_SERVICES;
  const services = data.services ?? [];
  const toggle = (s: ServiceKey) => {
    const has = services.some((x) => x.type === s);
    update("services", has ? services.filter((x) => x.type !== s) : [...services, makeService(s)]);
  };
  const patch = (s: ServiceKey, p: Partial<RegistrationService>) =>
    update(
      "services",
      services.map((x) => (x.type === s ? { ...x, ...p } : x)),
    );

  return (
    <div className="space-y-3">
      {err("services") && <Alert tone="red">{err("services")}</Alert>}
      {allowed.map((s) => {
        const svc = services.find((x) => x.type === s);
        const priceLabel = s === "rent" ? t("onboard.fields.pricePerDay") : t("onboard.fields.basePrice");
        return (
          <div key={s} className={cx("rounded-2xl border-2 p-4 transition", svc ? "border-green/40 bg-green/5" : "border-grey")}>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="checkbox" checked={!!svc} onChange={() => toggle(s)} className="h-5 w-5 accent-[#087C55]" />
              <span className={cx("flex h-10 w-10 items-center justify-center rounded-xl", svc ? "bg-green text-white" : "bg-charcoal/5 text-charcoal/60")}>
                <ServiceIcon service={s} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold">GoBert {t(`services.${s}.name`)}</span>
                <span className="block text-xs text-charcoal/55">{t(`services.${s}.desc`)}</span>
              </span>
            </label>
            {svc && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label={`${priceLabel} (FCFA)`} hint={formatXAF(svc.base_price_xaf, locale)} error={svc.base_price_xaf > 0 ? null : err("price")}>
                  <Input type="number" inputMode="numeric" min={0} step={25} value={svc.base_price_xaf} onChange={(e) => patch(s, { base_price_xaf: Math.max(0, Math.round(Number(e.target.value))) })} />
                </Field>
                <Field label={t("onboard.fields.zones")} hint={t("onboard.fields.zonesHint")}>
                  <Input value={svc.zones.join(", ")} onChange={(e) => patch(s, { zones: e.target.value.split(",").map((z) => z.trim()).filter(Boolean) })} />
                </Field>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FleetStep({ data, update }: Omit<StepProps, "err">) {
  const t = useTranslations();
  const locale = useLocale();
  const fleet = data.fleet ?? [];
  const [form, setForm] = useState<FleetInput>(EMPTY_FLEET);
  const [formError, setFormError] = useState(false);
  const add = () => {
    if (!form.brand.trim() || !form.model.trim() || form.plate.trim().length < 4 || !(form.price_per_day_xaf > 0)) {
      setFormError(true);
      return;
    }
    setFormError(false);
    update("fleet", [...fleet, { ...form, plate: form.plate.toUpperCase() }]);
    setForm(EMPTY_FLEET);
  };
  return (
    <div className="space-y-5">
      <Alert tone="blue" icon={<Info className="w-4 h-4" />}>
        {t("onboard.fleetIntro")}
      </Alert>
      {fleet.length > 0 && (
        <ul className="space-y-2">
          {fleet.map((v, i) => {
            const Icon = VEHICLE_ICON[v.type] ?? VEHICLE_ICON.car;
            return (
              <li key={`${v.plate}-${i}`} className="flex items-center gap-3 rounded-2xl border border-grey p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green/10 text-green">
                  <Icon className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {v.brand} {v.model} · {v.plate}
                  </p>
                  <p className="text-xs text-charcoal/55">
                    {formatXAF(v.price_per_day_xaf, locale)} {t("common.perDay")} · {v.with_driver ? t("rent.withDriver") : t("rent.noDriver")}
                  </p>
                </div>
                <button onClick={() => update("fleet", fleet.filter((_, j) => j !== i))} className="p-2 text-charcoal/40 hover:text-red-600" aria-label={t("common.remove")}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="rounded-2xl bg-ivory p-4 space-y-3">
        <p className="text-sm font-bold">{t("fleet.addTitle")}</p>
        <FleetForm value={form} onChange={setForm} />
        {formError && <p className="text-xs text-red-600">{t("fleet.formError")}</p>}
        <Button variant="soft" onClick={add}>
          <Plus className="w-4 h-4" /> {t("fleet.add")}
        </Button>
      </div>
    </div>
  );
}

function ScheduleStep({ data, update, err }: StepProps) {
  const t = useTranslations();
  const schedule = data.schedule ?? DEFAULT_SCHEDULE;
  const set = (p: Partial<typeof schedule>) => update("schedule", { ...schedule, ...p });
  const toggleDay = (d: number) => set({ days: schedule.days.includes(d) ? schedule.days.filter((x) => x !== d) : [...schedule.days, d] });
  return (
    <div className="space-y-5">
      <Toggle checked={schedule.is_24h} onChange={(v) => set({ is_24h: v })} label={t("onboard.fields.is24h")} description={t("onboard.fields.is24hHint")} />
      {!schedule.is_24h && (
        <>
          <Field label={t("onboard.fields.days")} error={err("days")}>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_ORDER.map((d) => {
                const on = schedule.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-pressed={on}
                    className={cx("h-11 rounded-xl text-xs font-bold transition", on ? "bg-green text-white" : "bg-white border border-grey text-charcoal/60 hover:border-green/40")}
                  >
                    {t(`days.${d}`)}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("onboard.fields.start")} error={err("hours")}>
              <Input type="time" value={schedule.start} onChange={(e) => set({ start: e.target.value })} />
            </Field>
            <Field label={t("onboard.fields.end")}>
              <Input type="time" value={schedule.end} onChange={(e) => set({ end: e.target.value })} />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}

function ReviewStep({ kind, data, errors, onJump }: { kind: "rider" | "business"; data: RegistrationData; errors: string[]; onJump: (s: StepKey) => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const s = data.schedule;
  const docs = kind === "business" ? BUSINESS_DOCS : RIDER_DOCS;
  const rows: { step: StepKey; label: string; value: string; bad?: boolean }[] =
    kind === "rider"
      ? [
          { step: "about", label: t("onboard.fields.full_name"), value: data.full_name ?? "—", bad: errors.includes("full_name") },
          { step: "about", label: t("onboard.fields.phone"), value: data.phone ?? "—", bad: errors.includes("phone") },
          {
            step: "vehicle",
            label: t("onboard.steps.vehicle"),
            value: data.vehicle_type ? `${t(`vehicleTypes.${data.vehicle_type}`)} · ${data.brand ?? ""} ${data.model ?? ""} · ${data.plate ?? ""}` : "—",
            bad: ["vehicle_type", "brand", "model", "plate"].some((k) => errors.includes(k)),
          },
        ]
      : [
          { step: "company", label: t("onboard.fields.business_name"), value: data.business_name ?? "—", bad: errors.includes("business_name") },
          { step: "company", label: t("onboard.fields.business_type"), value: data.business_type ? t(`businessTypes.${data.business_type}.name`) : "—", bad: errors.includes("business_type") },
          { step: "company", label: t("onboard.fields.registration_number"), value: data.registration_number ?? "—", bad: errors.includes("registration_number") },
          { step: "fleet", label: t("onboard.steps.fleet"), value: t("onboard.fleetCount", { count: data.fleet?.length ?? 0 }) },
        ];
  rows.push(
    {
      step: "documents",
      label: t("onboard.steps.documents"),
      value: `${data.documents?.length ?? 0} / ${docs.length}`,
      bad: errors.some((e) => e.startsWith("doc:")),
    },
    {
      step: "services",
      label: t("onboard.steps.services"),
      value: (data.services ?? []).map((x) => `${t(`services.${x.type}.name`)} (${formatXAF(x.base_price_xaf, locale)})`).join(", ") || "—",
      bad: errors.includes("services"),
    },
    {
      step: "schedule",
      label: t("onboard.steps.schedule"),
      value: s ? (s.is_24h ? t("onboard.fields.is24h") : `${DAY_ORDER.filter((d) => s.days.includes(d)).map((d) => t(`days.${d}`)).join(" ")} · ${s.start}–${s.end}`) : "—",
    },
  );
  return (
    <dl className="divide-y divide-grey/70">
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-3 py-3">
          <dt className="w-36 shrink-0 text-sm text-charcoal/55">{r.label}</dt>
          <dd className={cx("flex-1 text-sm font-semibold", r.bad && "text-red-600")}>{r.value}</dd>
          <button onClick={() => onJump(r.step)} className="text-xs font-bold text-green hover:underline">
            {t("common.edit")}
          </button>
        </div>
      ))}
    </dl>
  );
}
