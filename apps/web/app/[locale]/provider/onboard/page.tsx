"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronRight, ChevronLeft, Upload, X } from "lucide-react";
import { saveDraft, submitDraft, getProviderStatus } from "@/lib/registration-api";
import { compressImage, formatBytes } from "@/lib/image-compress";
import type { RegistrationData, RegistrationDocument } from "@/lib/mock-store";
import type { VehicleType } from "@/lib/booking-api";

const STEPS = ["identity", "vehicle", "documents", "services", "schedule", "review"] as const;
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DOC_TYPES = [
  { key: "id_card", label: "Pièce d'identité" },
  { key: "license", label: "Permis de conduire" },
  { key: "registration", label: "Carte grise" },
];

type ProviderStatus = "pending" | "approved" | "rejected" | "changes_requested" | "suspended" | null;

export default function OnboardPage() {
  const t = useTranslations();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<RegistrationData>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // restore draft from localStorage
  useEffect(() => {
    const raw = localStorage.getItem("gobert:reg:state");
    const did = localStorage.getItem("gobert:reg:draft_id");
    const pid = localStorage.getItem("gobert:reg:provider_id");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setStep(parsed.step ?? 0);
        setData(parsed.data ?? {});
      } catch {
        // ignore
      }
    }
    if (did) setDraftId(did);
    if (pid) setProviderId(pid);
  }, []);

  // poll provider status if submitted
  useEffect(() => {
    if (!providerId) return;
    const poll = () => getProviderStatus(providerId).then((s) => s && setStatus(s as ProviderStatus));
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [providerId]);

  const persist = useCallback(
    (nextStep: number, nextData: RegistrationData) => {
      localStorage.setItem("gobert:reg:state", JSON.stringify({ step: nextStep, data: nextData }));
    },
    [],
  );

  const autosave = useCallback(
    async (nextStep: number, nextData: RegistrationData) => {
      persist(nextStep, nextData);
      setSaving(true);
      try {
        const draft = await saveDraft(draftId, "provider-user", nextStep, nextData);
        setDraftId(draft.id);
        localStorage.setItem("gobert:reg:draft_id", draft.id);
      } catch {
        // ignore
      } finally {
        setSaving(false);
      }
    },
    [draftId, persist],
  );

  const update = <K extends keyof RegistrationData>(key: K, value: RegistrationData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const next = () => {
    const ns = Math.min(STEPS.length - 1, step + 1);
    setStep(ns);
    void autosave(ns, data);
  };
  const back = () => {
    const ns = Math.max(0, step - 1);
    setStep(ns);
    void autosave(ns, data);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const draft = await saveDraft(draftId, "provider-user", step, data);
      const provider = await submitDraft(draft.id);
      setProviderId(provider.id);
      setStatus(provider.verification_status as ProviderStatus);
      localStorage.setItem("gobert:reg:provider_id", provider.id);
    } catch (e: any) {
      setError(e?.message ?? "error");
    } finally {
      setSubmitting(false);
    }
  };

  const statusBanner = () => {
    if (!status) return null;
    const map: Record<string, { cls: string; label: string }> = {
      pending: { cls: "bg-orange/10 border-orange/30 text-orange", label: t("onboard.status.pending") },
      approved: { cls: "bg-green/10 border-green/30 text-green", label: t("onboard.status.approved") },
      rejected: { cls: "bg-red-50 border-red-200 text-red-600", label: t("onboard.status.rejected") },
      changes_requested: { cls: "bg-orange/10 border-orange/30 text-orange", label: t("onboard.status.changes_requested") },
      suspended: { cls: "bg-red-50 border-red-200 text-red-600", label: t("onboard.status.suspended") },
    };
    const s = map[status];
    if (!s) return null;
    return (
      <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${s.cls}`}>
        {s.label}
        {status === "pending" && <span className="block text-xs font-normal mt-1 opacity-80">{t("onboard.status.pendingHint")}</span>}
      </div>
    );
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-ivory p-4 sm:p-6">
      <div className="max-w-sm sm:max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-green">{t("onboard.title")}</h1>
          <span className="text-xs text-charcoal/50">
            {step + 1} / {STEPS.length}
          </span>
        </div>
        <div className="h-2 bg-grey rounded-full overflow-hidden">
          <div className="h-full bg-green transition-all" style={{ width: `${progress}%` }} />
        </div>

        {statusBanner()}

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider mb-4">
            {t(`onboard.${STEPS[step]}`)}
          </h2>

          {step === 0 && <IdentityStep data={data} update={update} t={t} />}
          {step === 1 && <VehicleStep data={data} update={update} t={t} />}
          {step === 2 && <DocumentsStep data={data} update={update} t={t} />}
          {step === 3 && <ServicesStep data={data} update={update} t={t} />}
          {step === 4 && <ScheduleStep data={data} update={update} t={t} />}
          {step === 5 && <ReviewStep data={data} t={t} />}
        </div>

        {error && <p className="text-xs text-orange">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            onClick={back}
            disabled={step === 0}
            className="border border-grey rounded-xl px-4 py-2.5 text-sm font-medium text-charcoal disabled:opacity-40 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("onboard.back")}
          </button>
          <div className="flex-1" />
          {saving && <span className="text-xs text-charcoal/40">{t("onboard.saving")}</span>}
          {step < STEPS.length - 1 ? (
            <button
              onClick={next}
              className="bg-green text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1"
            >
              {t("onboard.next")}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || !!providerId}
              className="bg-orange text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {providerId ? t("onboard.submitted") : submitting ? t("onboard.submitting") : t("onboard.submit")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type StepProps = { data: RegistrationData; update: <K extends keyof RegistrationData>(k: K, v: RegistrationData[K]) => void; t: any };

function IdentityStep({ data, update, t }: StepProps) {
  return (
    <div className="space-y-3">
      <Field label={t("onboard.fullName")}>
        <input value={data.full_name ?? ""} onChange={(e) => update("full_name", e.target.value)} placeholder={t("onboard.fullName")} className={inputCls} />
      </Field>
      <Field label={t("onboard.phone")}>
        <input value={data.phone ?? ""} onChange={(e) => update("phone", e.target.value)} placeholder="+237 6 99 00 00 01" className={inputCls} />
      </Field>
    </div>
  );
}

function VehicleStep({ data, update, t }: StepProps) {
  return (
    <div className="space-y-3">
      <Field label={t("onboard.vehicleType")}>
        <select value={data.vehicle_type ?? "moto"} onChange={(e) => update("vehicle_type", e.target.value as VehicleType)} className={inputCls}>
          <option value="moto">Moto</option>
          <option value="taxi">Taxi</option>
          <option value="tricycle">Tricycle</option>
          <option value="truck">Camion</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("onboard.brand")}>
          <input value={data.brand ?? ""} onChange={(e) => update("brand", e.target.value)} className={inputCls} />
        </Field>
        <Field label={t("onboard.model")}>
          <input value={data.model ?? ""} onChange={(e) => update("model", e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t("onboard.plate")}>
          <input value={data.plate ?? ""} onChange={(e) => update("plate", e.target.value)} placeholder="EST 123 AB" className={inputCls} />
        </Field>
        <Field label={t("onboard.year")}>
          <input type="number" value={data.year ?? ""} onChange={(e) => update("year", Number(e.target.value) || undefined)} className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

function DocumentsStep({ data, update, t }: StepProps) {
  const docs = data.documents ?? [];
  const setDocs = (next: RegistrationDocument[]) => update("documents", next);

  const onFile = async (type: string, file: File) => {
    const compressed = await compressImage(file);
    const doc: RegistrationDocument = { type, name: file.name, size: compressed.size, data_url: compressed.dataUrl };
    setDocs([...docs.filter((d) => d.type !== type), doc]);
  };

  return (
    <div className="space-y-3">
      {DOC_TYPES.map((dt) => {
        const existing = docs.find((d) => d.type === dt.key);
        return (
          <div key={dt.key} className="border border-grey rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-charcoal">{dt.label}</span>
              {existing && <span className="text-xs text-green">{formatBytes(existing.size)}</span>}
            </div>
            {existing ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={existing.data_url} alt="" className="w-16 h-16 object-cover rounded-lg" />
                <button onClick={() => setDocs(docs.filter((d) => d.type !== dt.key))} className="text-orange text-xs flex items-center gap-1">
                  <X className="w-3 h-3" /> {t("onboard.remove")}
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm text-charcoal/60 cursor-pointer">
                <Upload className="w-4 h-4" />
                {t("onboard.upload")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(dt.key, e.target.files[0])} />
              </label>
            )}
          </div>
        );
      })}
      <p className="text-xs text-charcoal/40">{t("onboard.compressHint")}</p>
    </div>
  );
}

function ServicesStep({ data, update, t }: StepProps) {
  const services = data.services ?? [];
  const setServices = (next: RegistrationData["services"]) => update("services", next);
  const updateService = (idx: number, patch: Partial<NonNullable<RegistrationData["services"]>[number]>) => {
    const next = [...services];
    next[idx] = { ...next[idx], ...patch };
    setServices(next);
  };
  return (
    <div className="space-y-3">
      {services.map((s, idx) => (
        <div key={idx} className="border border-grey rounded-xl p-3 space-y-2">
          <input value={s.title_fr} onChange={(e) => updateService(idx, { title_fr: e.target.value })} placeholder="Titre FR" className={inputCls} />
          <input value={s.title_en} onChange={(e) => updateService(idx, { title_en: e.target.value })} placeholder="Title EN" className={inputCls} />
          <div className="flex items-center gap-2">
            <input type="number" value={s.base_price_xaf} onChange={(e) => updateService(idx, { base_price_xaf: Number(e.target.value) })} placeholder="Prix XAF" className={inputCls} />
            <span className="text-xs text-charcoal/50">XAF</span>
          </div>
        </div>
      ))}
      <button
        onClick={() => setServices([...services, { type: "ride", title_fr: "", title_en: "", base_price_xaf: 500, zones: ["Bertoua"] }])}
        className="text-green text-sm font-medium"
      >
        + {t("onboard.addService")}
      </button>
    </div>
  );
}

function ScheduleStep({ data, update, t }: StepProps) {
  const schedule = data.schedule ?? { days: [1, 2, 3, 4, 5, 6, 0], start: "06:00", end: "22:00", is_24h: false };
  const setSchedule = (patch: Partial<typeof schedule>) => update("schedule", { ...schedule, ...patch });
  const toggleDay = (d: number) => {
    const days = schedule.days.includes(d) ? schedule.days.filter((x) => x !== d) : [...schedule.days, d];
    setSchedule({ days });
  };
  return (
    <div className="space-y-3">
      <Field label={t("onboard.days")}>
        <div className="flex gap-1">
          {DAYS.map((d, i) => (
            <button key={i} onClick={() => toggleDay(i)} className={`flex-1 rounded-lg py-1.5 text-xs border ${schedule.days.includes(i) ? "bg-green border-green text-green" : "border-grey text-charcoal/60"}`}>
              {d}
            </button>
          ))}
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input type="checkbox" checked={schedule.is_24h} onChange={(e) => setSchedule({ is_24h: e.target.checked })} />
        {t("onboard.is24h")}
      </label>
      {!schedule.is_24h && (
        <div className="grid grid-cols-2 gap-2">
          <Field label={t("onboard.start")}>
            <input type="time" value={schedule.start} onChange={(e) => setSchedule({ start: e.target.value })} className={inputCls} />
          </Field>
          <Field label={t("onboard.end")}>
            <input type="time" value={schedule.end} onChange={(e) => setSchedule({ end: e.target.value })} className={inputCls} />
          </Field>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ data, t }: { data: RegistrationData; t: any }) {
  const s = data.schedule;
  return (
    <div className="space-y-2 text-sm">
      <Row label={t("onboard.fullName")} value={data.full_name ?? "—"} />
      <Row label={t("onboard.phone")} value={data.phone ?? "—"} />
      <Row label={t("onboard.vehicleType")} value={data.vehicle_type ?? "—"} />
      <Row label={t("onboard.plate")} value={data.plate ?? "—"} />
      <Row label={t("onboard.documents")} value={`${data.documents?.length ?? 0}`} />
      <Row label={t("onboard.services")} value={`${data.services?.length ?? 0}`} />
      <Row label={t("onboard.schedule")} value={s ? (s.is_24h ? "24/7" : `${s.start}–${s.end}`) : "—"} />
    </div>
  );
}

const inputCls = "w-full border border-grey rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-grey/50 py-1.5">
      <span className="text-charcoal/50">{label}</span>
      <span className="font-medium text-charcoal">{value}</span>
    </div>
  );
}