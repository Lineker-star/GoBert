"use client";
import { useState } from "react";

export type Series = { key: string; label: string; color: string; format?: (n: number) => string };

/**
 * Small dependency-free bar chart for daily figures. One series is shown at a time
 * (tabs), with the total for the period, the busiest day and a tooltip per bar.
 */
export default function TrendChart<T extends { day: string }>({ data, series }: { data: T[]; series: Series[] }) {
  const [active, setActive] = useState(series[0]?.key);
  const [hover, setHover] = useState<number | null>(null);
  const s = series.find((x) => x.key === active) ?? series[0];
  const fmt = s.format ?? ((n: number) => new Intl.NumberFormat("fr-FR").format(n));
  const values = data.map((d) => Number((d as Record<string, unknown>)[s.key] ?? 0));
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const best = values.indexOf(Math.max(...values));
  const label = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const shown = hover ?? values.length - 1;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Indicateur">
        {series.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={x.key === s.key}
            onClick={() => setActive(x.key)}
            className={`rounded-full px-3 h-8 text-xs font-semibold transition ${x.key === s.key ? "bg-forest text-white" : "bg-ivory text-charcoal/65 hover:text-charcoal"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-charcoal/50">Total sur {data.length} jours</p>
          <p className="text-2xl font-extrabold">{fmt(total)}</p>
        </div>
        {data.length > 0 && (
          <p className="text-xs text-charcoal/55" aria-live="polite">
            {label(data[shown].day)} : <span className="font-bold text-charcoal">{fmt(values[shown])}</span>
            {total > 0 && hover === null && <> · pic le {label(data[best].day)}</>}
          </p>
        )}
      </div>

      <div className="mt-3 flex h-40 items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
        {values.map((v, i) => (
          <button
            key={data[i].day}
            type="button"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${label(data[i].day)} : ${fmt(v)}`}
            className="group relative flex h-full flex-1 items-end rounded-t-md focus:outline-none"
          >
            <span
              className="block w-full rounded-t-md transition-all group-hover:opacity-100 group-focus-visible:ring-2 group-focus-visible:ring-forest"
              style={{ height: `${v === 0 ? 2 : Math.max(4, (v / max) * 100)}%`, background: s.color, opacity: hover === null || hover === i ? 1 : 0.45 }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-charcoal/40">
        <span>{data[0] && label(data[0].day)}</span>
        <span>{data.length > 2 && label(data[Math.floor(data.length / 2)].day)}</span>
        <span>{data.length > 1 && label(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}
