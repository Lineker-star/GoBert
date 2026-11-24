"use client";
import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { getOverview, type Overview } from "@/lib/admin-api";

const DECISION_LABEL: Record<string, string> = {
  approve: "Approuvé",
  reject: "Rejeté",
  request_changes: "Modifications demandées",
  suspend: "Suspendu",
};

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    getOverview().then(setData);
  }, []);

  const cards = [
    { label: "En attente", value: data?.overview.pending ?? 0, tone: "text-orange" },
    { label: "Approuvés", value: data?.overview.approved ?? 0, tone: "text-green" },
    { label: "Actifs", value: data?.overview.active ?? 0, tone: "text-charcoal" },
    { label: "Courses aujourd'hui", value: data?.overview.bookings_today ?? 0, tone: "text-charcoal" },
  ];

  return (
    <AdminShell>
      <h1 className="text-xl font-bold text-green mb-6">Vue d&apos;ensemble</h1>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl shadow-sm p-5">
            <div className="text-xs text-charcoal/50 uppercase tracking-wider">{c.label}</div>
            <div className={`text-3xl font-bold mt-1 ${c.tone}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider mb-3">Journal d&apos;audit</h2>
        {(data?.audit.length ?? 0) === 0 ? (
          <p className="text-sm text-charcoal/40">Aucune décision pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {data!.audit
              .slice()
              .reverse()
              .slice(0, 10)
              .map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b border-grey/50 py-2 text-sm">
                  <span className="font-medium text-charcoal">{DECISION_LABEL[a.decision] ?? a.decision}</span>
                  <span className="text-charcoal/50">
                    {a.provider_id?.slice(-4)} · {new Date(a.at).toLocaleString("fr")}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}