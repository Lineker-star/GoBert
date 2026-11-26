"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Banknote, Bike, Building2, CalendarDays, KeyRound, Package, ShieldCheck, Users } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { Card, PageTitle, StatusBadge, dt, fcfa } from "@/components/ui";
import { getOverview, getQueue, type Overview, type Provider } from "@/lib/admin-api";

const DECISION_STATUS: Record<string, string> = { approve: "approved", reject: "rejected", request_changes: "changes_requested", suspend: "suspended" };

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [queue, setQueue] = useState<Provider[]>([]);

  useEffect(() => {
    const load = () => {
      getOverview().then(setData);
      getQueue("pending").then(setQueue);
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  const o = data?.overview;
  const tiles = [
    { label: "En attente de vérification", value: o?.pending ?? "—", Icon: ShieldCheck, tone: "bg-orange text-white", href: "/providers?status=pending" },
    { label: "Riders vérifiés", value: o ? `${o.riders.approved} / ${o.riders.total}` : "—", Icon: Bike, tone: "bg-green text-white", href: "/providers?kind=rider" },
    { label: "Prestataires vérifiés", value: o ? `${o.businesses.approved} / ${o.businesses.total}` : "—", Icon: Building2, tone: "bg-forest text-white", href: "/providers?kind=business" },
    { label: "Comptes inscrits", value: o?.users.total ?? "—", Icon: Users, tone: "bg-green/10 text-green", href: "/users" },
    { label: "Courses aujourd'hui", value: o?.bookings_today ?? "—", Icon: CalendarDays, tone: "bg-green/10 text-green", href: "/activity" },
    { label: "Revenu des courses (jour)", value: fcfa(o?.revenue_today_xaf), Icon: Banknote, tone: "bg-green/10 text-green", href: "/activity" },
    { label: "Locations à traiter", value: o?.rentals_open ?? "—", Icon: KeyRound, tone: "bg-orange/15 text-[#B25E0B]", href: "/activity?tab=rentals" },
    { label: "Colis en cours", value: o?.parcels_open ?? "—", Icon: Package, tone: "bg-orange/15 text-[#B25E0B]", href: "/activity?tab=parcels" },
  ];

  return (
    <AdminShell>
      <PageTitle title="Vue d'ensemble" subtitle="Activité de la plateforme en temps réel (rafraîchie toutes les 15 s)." />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map(({ label, value, Icon, tone, href }) => (
          <Link key={label} href={href}>
            <Card className="p-4 h-full transition hover:shadow-md hover:border-green/30">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="w-5 h-5" />
              </span>
              <p className="mt-3 text-2xl font-extrabold">{value}</p>
              <p className="text-xs text-charcoal/55">{label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {o && (
        <Card className="mt-6 p-5">
          <p className="text-sm font-bold">Répartition des comptes</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-grey">
            {(["customer", "rider", "business"] as const).map((r, i) => (
              <div
                key={r}
                className={i === 0 ? "bg-green" : i === 1 ? "bg-orange" : "bg-forest"}
                style={{ width: `${o.users.total ? (o.users[r] / o.users.total) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-charcoal/65">
            <span><span className="inline-block h-2 w-2 rounded-full bg-green mr-1.5" />Clients {o.users.customer}</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-orange mr-1.5" />Riders {o.users.rider}</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-forest mr-1.5" />Prestataires {o.users.business}</span>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="font-bold">File de vérification</h2>
            <Link href="/providers?status=pending" className="inline-flex items-center gap-1 text-sm font-semibold text-green">
              Tout voir <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {queue.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-charcoal/50">Aucun dossier en attente. 🎉</p>
          ) : (
            <ul className="divide-y divide-grey/70">
              {queue.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/providers/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-ivory/60">
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${p.kind === "rider" ? "bg-orange/15 text-[#B25E0B]" : "bg-forest/10 text-forest"}`}>
                      {p.kind === "rider" ? "Rider" : "Prestataire"}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold">{p.display_name}</span>
                    <span className="text-xs text-charcoal/45">{dt(p.submitted_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="p-5 pb-3 font-bold">Dernières décisions</h2>
          {(data?.audit.length ?? 0) === 0 ? (
            <p className="px-5 pb-5 text-sm text-charcoal/50">Aucune décision pour le moment.</p>
          ) : (
            <ul className="divide-y divide-grey/70">
              {data!.audit
                .slice()
                .reverse()
                .slice(0, 8)
                .map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <StatusBadge status={DECISION_STATUS[a.decision] ?? a.decision} />
                    <Link href={`/providers/${a.provider_id}`} className="flex-1 truncate text-charcoal/70 hover:text-green">
                      {a.reason || "—"}
                    </Link>
                    <span className="text-xs text-charcoal/45">{dt(a.at)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
