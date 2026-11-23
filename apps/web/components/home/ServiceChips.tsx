"use client";
import { useTranslations } from "next-intl";
import { Bike, Car, Package, Truck, KeyRound } from "lucide-react";

type ServiceKey = "moto" | "ride" | "express" | "cargo" | "rent";

const SERVICE_ICONS: Record<ServiceKey, React.ElementType> = {
  moto: Bike,
  ride: Car,
  express: Package,
  cargo: Truck,
  rent: KeyRound,
};

interface ServiceChipProps {
  serviceKey: ServiceKey;
  label: string;
  count: number;
  selected: boolean;
  onSelect: (key: ServiceKey) => void;
}

function ServiceChip({ serviceKey, label, count, selected, onSelect }: ServiceChipProps) {
  const Icon = SERVICE_ICONS[serviceKey];
  return (
    <button
      onClick={() => onSelect(serviceKey)}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition
        ${selected
          ? "bg-green border-green text-green"
          : "bg-white border-grey text-charcoal hover:border-green/50"}
      `}
    >
      <Icon className={`w-4 h-4 ${selected ? "" : "text-charcoal/60"}`} />
      <span>{label}</span>
      <span className="text-xs border border-current rounded-full px-1.5 py-0 opacity-70">{count}</span>
    </button>
  );
}

interface ServiceChipsProps {
  services: { key: ServiceKey; label: string; count: number }[];
  selected: ServiceKey | null;
  onSelect: (key: ServiceKey) => void;
  className?: string;
}

export default function ServiceChips({ services, selected, onSelect, className }: ServiceChipsProps) {
  const t = useTranslations();
  return (
    <div className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide ${className ?? ""}`}>
      {services.map((s) => (
        <ServiceChip
          key={s.key}
          serviceKey={s.key}
          label={s.label}
          count={s.count}
          selected={selected === s.key}
          onSelect={onSelect}
        />
      ))}
      <button className="px-3 py-2 rounded-xl border border-grey text-charcoal text-sm hover:bg-charcoal/5">
        {t("providers.available")}
      </button>
    </div>
  );
}