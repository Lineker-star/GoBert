"use client";

export function cx(...p: (string | false | null | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
  changes_requested: "Modifs demandées",
  suspended: "Suspendu",
  requested: "Demandée",
  accepted: "Acceptée",
  arriving: "Arrivé",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
  expired: "Expirée",
  confirmed: "Confirmée",
  declined: "Refusée",
  active: "En cours",
  in_transit: "En route",
  delivered: "Livré",
};

const TONE: Record<string, string> = {
  approved: "bg-green/10 text-green",
  completed: "bg-green/10 text-green",
  confirmed: "bg-green/10 text-green",
  delivered: "bg-green/10 text-green",
  pending: "bg-orange/15 text-[#B25E0B]",
  requested: "bg-orange/15 text-[#B25E0B]",
  changes_requested: "bg-orange/15 text-[#B25E0B]",
  rejected: "bg-red-50 text-red-600",
  declined: "bg-red-50 text-red-600",
  suspended: "bg-red-50 text-red-600",
  accepted: "bg-blue-50 text-blue-700",
  arriving: "bg-blue-50 text-blue-700",
  in_progress: "bg-blue-50 text-blue-700",
  in_transit: "bg-blue-50 text-blue-700",
  active: "bg-blue-50 text-blue-700",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-xs text-charcoal/40">—</span>;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONE[status] ?? "bg-charcoal/5 text-charcoal/70")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("bg-white rounded-2xl border border-grey shadow-[0_1px_2px_rgba(18,61,50,0.04)]", className)}>{children}</div>;
}

export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 h-9 text-sm font-semibold transition",
        active ? "bg-forest text-white" : "bg-white border border-grey text-charcoal/70 hover:border-green/40",
      )}
    >
      {children}
    </button>
  );
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-charcoal">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-charcoal/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Initials({ name, size = 36, dark }: { name: string; size?: number; dark?: boolean }) {
  const parts = name.trim().split(/\s+/);
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white", dark ? "bg-forest" : "bg-gradient-to-br from-green to-forest")}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {ini || "GB"}
    </span>
  );
}

export const fcfa = (n: number | null | undefined) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0))} FCFA`;
export const dt = (iso: string | null | undefined, time = true) =>
  iso
    ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Douala", day: "numeric", month: "short", ...(time ? { hour: "2-digit", minute: "2-digit" } : { year: "numeric" }) }).format(new Date(iso))
    : "—";

export const KIND_LABEL: Record<string, string> = { rider: "Rider", business: "Prestataire" };
export const ROLE_LABEL: Record<string, string> = { customer: "Client", rider: "Rider", business: "Prestataire" };
export const SERVICE_LABEL: Record<string, string> = { moto: "Moto", ride: "Ride", express: "Express", cargo: "Cargo", rent: "Location", logistics: "Logistique" };
export const VEHICLE_LABEL: Record<string, string> = { moto: "Moto", taxi: "Taxi", tricycle: "Tricycle", truck: "Camion", car: "Voiture", van: "Minibus" };
export const BUSINESS_LABEL: Record<string, string> = { delivery: "Livraison", car_rental: "Location de véhicules", logistics: "Logistique", other: "Autre transport" };
export const DOC_LABEL: Record<string, string> = {
  id_card: "CNI",
  license: "Permis de conduire",
  registration: "Carte grise",
  insurance: "Assurance",
  rider_photo: "Photo du rider",
  business_registration: "RCCM",
  manager_id: "CNI du gérant",
  tax_card: "Carte de contribuable",
};
export const PAYMENT_LABEL: Record<string, string> = { cash: "Espèces", mtn_momo: "MTN MoMo", orange_money: "Orange Money" };
