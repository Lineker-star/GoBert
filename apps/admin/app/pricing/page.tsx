"use client";
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { Card, PageTitle, VEHICLE_LABEL, fcfa } from "@/components/ui";
import { getPricing, setPricing, type PricingRule } from "@/lib/admin-api";

const DEFAULTS: PricingRule[] = [
  { vehicle_type: "moto", base_fare: 300, per_km: 100, per_min: 25, min_fare: 500 },
  { vehicle_type: "taxi", base_fare: 500, per_km: 150, per_min: 30, min_fare: 800 },
  { vehicle_type: "tricycle", base_fare: 400, per_km: 120, per_min: 25, min_fare: 600 },
  { vehicle_type: "truck", base_fare: 1000, per_km: 300, per_min: 50, min_fare: 2000 },
];

/** Fare formula used by estimate_trip(): max(min, base + per_km × km + per_min × minutes), rounded to 25 FCFA. */
export default function PricingPage() {
  const [rules, setRules] = useState<PricingRule[]>(DEFAULTS);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getPricing().then((saved) => setRules(DEFAULTS.map((d) => saved.find((s) => s.vehicle_type === d.vehicle_type) ?? d)));
  }, []);

  const save = async (r: PricingRule) => {
    setBusy(r.vehicle_type);
    setMsg(null);
    const res = await setPricing(r);
    setBusy(null);
    setMsg(res.ok ? `Tarif ${VEHICLE_LABEL[r.vehicle_type]} enregistré.` : res.error ?? "Erreur");
  };

  const upd = (vt: string, k: keyof PricingRule, v: number) => setRules((rs) => rs.map((r) => (r.vehicle_type === vt ? { ...r, [k]: Math.max(0, Math.round(v)) } : r)));
  const sample = (r: PricingRule) => Math.max(r.min_fare, Math.round((r.base_fare + r.per_km * 5 + r.per_min * 12) / 25) * 25);
  const cell = "h-10 w-full rounded-lg border border-grey px-2 text-sm focus:outline-none focus:border-green";

  return (
    <AdminShell>
      <PageTitle title="Tarifs" subtitle="Prix = max(minimum, base + prix/km × km + prix/min × minutes), arrondi à 25 FCFA. S'applique aux nouvelles estimations." />
      {msg && <p className="mb-4 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green">{msg}</p>}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-ivory text-left text-xs uppercase tracking-wider text-charcoal/50">
            <tr>
              <th className="px-4 py-3">Véhicule</th>
              <th className="px-4 py-3">Base</th>
              <th className="px-4 py-3">/ km</th>
              <th className="px-4 py-3">/ minute</th>
              <th className="px-4 py-3">Minimum</th>
              <th className="px-4 py-3">Ex. 5 km</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.vehicle_type} className="border-t border-grey/60">
                <td className="px-4 py-3 font-bold">{VEHICLE_LABEL[r.vehicle_type]}</td>
                {(["base_fare", "per_km", "per_min", "min_fare"] as const).map((k) => (
                  <td key={k} className="px-2 py-2">
                    <input type="number" min={0} className={cell} value={r[k]} onChange={(e) => upd(r.vehicle_type, k, Number(e.target.value))} aria-label={k} />
                  </td>
                ))}
                <td className="px-4 py-3 text-charcoal/65">{fcfa(sample(r))}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => save(r)} disabled={!!busy} className="inline-flex h-9 items-center gap-1 rounded-lg bg-green px-3 text-xs font-bold text-white disabled:opacity-50">
                    {busy === r.vehicle_type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
