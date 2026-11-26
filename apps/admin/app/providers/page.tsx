"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Search } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { Card, Initials, PageTitle, Pill, SERVICE_LABEL, StatusBadge, VEHICLE_LABEL, BUSINESS_LABEL, dt } from "@/components/ui";
import { getQueue, type Provider } from "@/lib/admin-api";

const STATUSES = [
  { key: "", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "changes_requested", label: "Modifs demandées" },
  { key: "approved", label: "Approuvés" },
  { key: "rejected", label: "Rejetés" },
  { key: "suspended", label: "Suspendus" },
];
const KINDS = [
  { key: "", label: "Riders & prestataires" },
  { key: "rider", label: "Riders" },
  { key: "business", label: "Prestataires" },
];

export default function ProvidersPage() {
  const [status, setStatus] = useState("pending");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<Provider[] | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("status")) setStatus(q.get("status") ?? "");
    if (q.has("kind")) {
      setKind(q.get("kind") ?? "");
      if (!q.has("status")) setStatus("");
    }
  }, []);

  useEffect(() => {
    setList(null);
    getQueue(status || undefined, kind || undefined).then(setList);
  }, [status, kind]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter(
      (p) => !q || p.display_name.toLowerCase().includes(q) || p.phone.includes(q) || p.vehicle?.plate.toLowerCase().includes(q) || p.business?.registration_number.toLowerCase().includes(q),
    );
  }, [list, query]);

  return (
    <AdminShell>
      <PageTitle title="Vérifications" subtitle="Les riders et prestataires ne sont visibles par les clients qu'après approbation." />

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Pill key={k.key} active={kind === k.key} onClick={() => setKind(k.key)}>
            {k.label}
          </Pill>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            aria-pressed={status === s.key}
            className={`rounded-lg px-3 h-8 text-xs font-bold transition ${status === s.key ? "bg-green text-white" : "text-charcoal/60 hover:bg-charcoal/5"}`}
          >
            {s.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, téléphone, plaque, RCCM…"
            className="w-full h-10 rounded-xl border border-grey bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-green"
          />
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ivory text-left text-xs uppercase tracking-wider text-charcoal/50">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 hidden md:table-cell">Véhicule / activité</th>
                <th className="px-4 py-3 hidden lg:table-cell">Services</th>
                <th className="px-4 py-3 hidden md:table-cell">Soumis le</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {list === null && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-charcoal/40">
                    Chargement…
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-grey/60 hover:bg-ivory/50">
                  <td className="px-4 py-3">
                    <Link href={`/providers/${p.id}`} className="flex items-center gap-3">
                      {p.kind === "business" ? (
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest text-white">
                          <Building2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <Initials name={p.display_name} />
                      )}
                      <span>
                        <span className="block font-semibold">{p.display_name}</span>
                        <span className="block text-xs text-charcoal/50">
                          {p.phone} · {p.city}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${p.kind === "rider" ? "bg-orange/15 text-[#B25E0B]" : "bg-forest/10 text-forest"}`}>
                      {p.kind === "rider" ? "Rider" : "Prestataire"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-charcoal/65">
                    {p.vehicle ? `${VEHICLE_LABEL[p.vehicle.type] ?? p.vehicle.type} · ${p.vehicle.brand} ${p.vehicle.model} · ${p.vehicle.plate}` : p.business ? BUSINESS_LABEL[p.business.type] ?? p.business.type : "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-charcoal/65">{p.services.map((s) => SERVICE_LABEL[s] ?? s).join(", ")}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-charcoal/55">{dt(p.submitted_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.verification_status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/providers/${p.id}`} className="inline-flex items-center gap-1 font-semibold text-green">
                      Examiner <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {list !== null && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-charcoal/45">
                    Aucun dossier pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
