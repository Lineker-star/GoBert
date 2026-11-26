"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { Card, PageTitle, dt } from "@/components/ui";
import { getAuditLog, type AuditRow } from "@/lib/admin-api";

const ACTION_LABEL: Record<string, string> = {
  approve: "Approbation",
  reject: "Rejet",
  request_changes: "Modifications demandées",
  suspend: "Suspension",
  create: "Création (en attente)",
  create_approved: "Création validée",
  edit: "Modification",
  submit: "Dossier envoyé",
  block: "Blocage de compte",
  unblock: "Déblocage de compte",
  cancel: "Annulation de course",
  pricing: "Changement de tarif",
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    getAuditLog().then(setRows);
  }, []);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || [r.action, r.entity, r.reason, r.actor_name].some((x) => (x ?? "").toLowerCase().includes(s)));
  }, [rows, q]);

  return (
    <AdminShell>
      <PageTitle title="Journal d'audit" subtitle="Toutes les actions sensibles (décisions, comptes, tarifs), avec leur auteur. 500 plus récentes." />
      <div className="relative mb-4 w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" className="w-full h-10 rounded-xl border border-grey bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-green" />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ivory text-left text-xs uppercase tracking-wider text-charcoal/50">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Objet</th>
              <th className="px-4 py-3">Auteur</th>
              <th className="px-4 py-3">Motif</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-charcoal/40">
                  Chargement…
                </td>
              </tr>
            )}
            {list.map((r) => (
              <tr key={r.id} className="border-t border-grey/60">
                <td className="px-4 py-3 whitespace-nowrap text-charcoal/55">{dt(r.at)}</td>
                <td className="px-4 py-3 font-semibold">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="px-4 py-3">
                  {r.entity === "provider" && r.entity_id ? (
                    <Link href={`/providers/${r.entity_id}`} className="text-green hover:underline">
                      Prestataire
                    </Link>
                  ) : (
                    r.entity
                  )}
                </td>
                <td className="px-4 py-3">{r.actor_name ?? (r.actor ? r.actor.slice(0, 8) : "Système")}</td>
                <td className="px-4 py-3 text-charcoal/65">{r.reason ?? "—"}</td>
              </tr>
            ))}
            {rows !== null && list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-charcoal/45">
                  Aucune entrée.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </AdminShell>
  );
}
