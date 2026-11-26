"use client";
import { useTranslations } from "next-intl";
import { Field, Input, Select, Toggle } from "@/components/ui/primitives";
import type { FleetInput } from "@/lib/mock-store";

export const EMPTY_FLEET: FleetInput = { type: "car", brand: "", model: "", plate: "", price_per_day_xaf: 15000, price_per_hour_xaf: 3000, deposit_xaf: 30000, with_driver: true, seats: 5 };

export function FleetForm({ value, onChange }: { value: FleetInput; onChange: (v: FleetInput) => void }) {
  const t = useTranslations();
  const set = <K extends keyof FleetInput>(k: K, v: FleetInput[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("fleet.type")}>
        <Select value={value.type} onChange={(e) => set("type", e.target.value as FleetInput["type"])}>
          {(["car", "van", "truck", "moto", "tricycle"] as const).map((ty) => (
            <option key={ty} value={ty}>
              {t(`rentalTypes.${ty}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("onboard.fields.plate")}>
        <Input value={value.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} placeholder="ES 123 AB" />
      </Field>
      <Field label={t("onboard.fields.brand")}>
        <Input value={value.brand} onChange={(e) => set("brand", e.target.value)} />
      </Field>
      <Field label={t("onboard.fields.model")}>
        <Input value={value.model} onChange={(e) => set("model", e.target.value)} />
      </Field>
      <Field label={`${t("onboard.fields.pricePerDay")} (FCFA)`}>
        <Input type="number" inputMode="numeric" min={0} step={500} value={value.price_per_day_xaf} onChange={(e) => set("price_per_day_xaf", Number(e.target.value))} />
      </Field>
      <Field label={`${t("onboard.fields.pricePerHour")} (FCFA)`}>
        <Input type="number" inputMode="numeric" min={0} step={100} value={value.price_per_hour_xaf} onChange={(e) => set("price_per_hour_xaf", Number(e.target.value))} />
      </Field>
      <Field label={`${t("rent.deposit")} (FCFA)`}>
        <Input type="number" inputMode="numeric" min={0} step={500} value={value.deposit_xaf} onChange={(e) => set("deposit_xaf", Number(e.target.value))} />
      </Field>
      <Field label={t("onboard.fields.seats")}>
        <Input type="number" inputMode="numeric" min={1} value={value.seats ?? ""} onChange={(e) => set("seats", Number(e.target.value) || null)} />
      </Field>
      <div className="sm:col-span-2">
        <Toggle checked={value.with_driver} onChange={(v) => set("with_driver", v)} label={t("rent.withDriver")} description={t("fleet.withDriverHint")} />
      </div>
    </div>
  );
}
