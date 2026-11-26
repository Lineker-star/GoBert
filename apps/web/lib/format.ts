const TZ = "Africa/Douala";

const tag = (locale: string) => (locale === "fr" ? "fr-FR" : "en-GB");

/** XAF is an integer currency — never show decimals. */
export function formatXAF(amount: number | null | undefined, locale: string): string {
  const n = Math.round(amount ?? 0);
  return `${new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 0 }).format(n)} FCFA`;
}

export function formatDate(iso: string | null | undefined, locale: string, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(tag(locale), {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: withTime ? undefined : "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

export function formatKm(meters: number, locale: string): string {
  return `${new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "GB";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "GB";
}

/** Today's date in Douala as yyyy-mm-dd (for <input type="date" min>). */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Cameroon mobile numbers: 9 digits starting with 6 (MTN, Orange, Camtel, Nexttel). */
export function isValidCameroonMobile(local: string): boolean {
  return /^6\d{8}$/.test(local.replace(/\D/g, ""));
}

export function normalizePhone(prefix: string, local: string): string {
  return `${prefix}${local.replace(/\D/g, "")}`;
}

export function whatsappLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
