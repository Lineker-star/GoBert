"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { getQueue, type QueueProvider } from "@/lib/admin-api";

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Approuvés" },
  { key: "rejected", label: "Rejetés" },
  { key: "suspended", label: "Suspendus" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
  changes_requested: "Modifs. demandées",
  suspended: "Suspendu",
};

export default function ProvidersPage() {
  const [filter, setFilter] = useState("");
  const [list, setList] = useState<QueueProvider[]>([]);

  useEffect(() => {
    getQueue(filter || undefined).then(setList);
  }, [filter]);

  return (
    <AdminShell>
      <h1 className="text-xl font-bold text-green mb-4">Prestataires</h1>
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              filter === f.key ? "bg-green border-green text-green" : "border-grey text-charcoal"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-grey/40 text-charcoal/60 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Véhicule</th>
              <th className="text-left px-4 py-3">Immatriculation</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-grey/50 hover:bg-charcoal/5">
                <td className="px-4 py-3 font-medium text-charcoal">{p.display_name}</td>
                <td className="px-4 py-3 text-charcoal/60">
                  {p.vehicle.brand} {p.vehicle.model}
                </td>
                <td className="px-4 py-3 text-charcoal/60">{p.vehicle.plate}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      p.verification_status === "approved"
                        ? "bg-green/10 text-green"
                        : p.verification_status === "pending"
                          ? "bg-orange/10 text-orange"
                          : "bg-red-50 text-red-600"
                    }`}
                  >
                    {STATUS_LABEL[p.verification_status] ?? p.verification_status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/providers/${p.id}`} className="text-green font-medium">
                    Examiner →
                  </Link>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-charcoal/40">
                  Aucun prestataire.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}