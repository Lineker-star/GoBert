"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Crosshair, Loader2, MapPin, X } from "lucide-react";
import { searchPlaces, type Place } from "@/lib/geocode";
import { BERTOUA_PLACES } from "@/lib/constants";
import { cx } from "@/components/ui/primitives";

export type PlacePoint = { lat: number; lng: number; label: string };

/** Text field with place suggestions (local landmarks first, then OpenStreetMap search). */
export default function PlaceField({
  kind,
  value,
  onChange,
  near,
  active,
  onFocus,
  onUseGps,
  gpsBusy,
  placeholder,
}: {
  kind: "pickup" | "dropoff";
  value: PlacePoint | null;
  onChange: (p: PlacePoint | null) => void;
  near: { lat: number; lng: number };
  active?: boolean;
  onFocus?: () => void;
  onUseGps?: () => void;
  gpsBusy?: boolean;
  placeholder: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [text, setText] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value?.label ?? ""), [value?.label]);

  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    if (q.length < 2 || q === value?.label) {
      setResults([]);
      setLoading(false);
      return;
    }
    const local = BERTOUA_PLACES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())).map((p) => ({ lat: p.lat, lng: p.lng, label: p.label, address: "Bertoua" }));
    setResults(local);
    setLoading(true);
    const tmr = setTimeout(() => {
      searchPlaces(q, near, locale)
        .then((r) => setResults([...local, ...r.filter((x) => !local.some((l) => l.label === x.label))].slice(0, 8)))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(tmr);
  }, [text, open, near, locale, value?.label]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (p: Place) => {
    onChange({ lat: p.lat, lng: p.lng, label: p.label });
    setOpen(false);
    setLoading(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div
        className={cx(
          "flex items-center gap-3 rounded-2xl border-2 bg-white px-3 h-14 transition",
          active ? "border-green shadow-sm shadow-green/10" : "border-transparent bg-ivory",
        )}
      >
        <span className={cx("h-3 w-3 shrink-0 rounded-full", kind === "pickup" ? "border-[3px] border-green bg-white" : "bg-orange ring-4 ring-orange/15")} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal/45">{kind === "pickup" ? t("booking.pickup") : t("booking.dropoff")}</p>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              onFocus?.();
              setOpen(true);
            }}
            placeholder={placeholder}
            aria-label={kind === "pickup" ? t("booking.pickup") : t("booking.dropoff")}
            className="w-full truncate bg-transparent text-[15px] font-semibold text-charcoal placeholder:font-medium placeholder:text-charcoal/40 focus:outline-none"
          />
        </div>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-charcoal/40" />}
        {value && !loading && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setText("");
            }}
            className="p-1 text-charcoal/35 hover:text-charcoal"
            aria-label={t("common.remove")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {onUseGps && (
          <button type="button" onClick={onUseGps} className="flex h-9 w-9 items-center justify-center rounded-full bg-green/10 text-green hover:bg-green/20" aria-label={t("geo.button")} title={t("geo.button")}>
            {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-grey bg-white py-1 shadow-xl" role="listbox">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button type="button" onClick={() => pick(r)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-ivory">
                <MapPin className="mt-0.5 w-4 h-4 shrink-0 text-green" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.label}</span>
                  {r.address && <span className="block truncate text-xs text-charcoal/50">{r.address}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
