"use client";
import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { Card, PAYMENT_LABEL, PageTitle, Pill, StatusBadge, VEHICLE_LABEL, dt, fcfa } from "@/components/ui";
import ExportButton from "@/components/ExportButton";
import { cancelTrip, getActivity, type Activity } from "@/lib/admin-api";

type Tab = "bookings" | "rentals" | "parcels";

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>("bookings");
  const [data, setData] = useState<Activity | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab");
    if (q === "rentals" || q === "parcels") setTab(q);
    const load = () => getActivity().then(setData);
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  const th = "px-4 py-3";
  const td = "px-4 py-3";

  return (
    <AdminShell>
      <PageTitle
        title="Activité"
        subtitle="Courses, locations et livraisons (200 plus récentes, rafraîchies toutes les 10 s)."
        action={
          tab === "bookings" ? (
            <ExportButton
              name="gobert-courses"
              rows={data?.bookings}
              columns={[
                { label: "Date", value: (b) => b.created_at },
                { label: "Statut", value: (b) => b.status },
                { label: "Véhicule", value: (b) => VEHICLE_LABEL[b.vehicle_type] ?? b.vehicle_type },
                { label: "Départ", value: (b) => b.pickup?.label },
                { label: "Arrivée", value: (b) => b.dropoff?.label },
                { label: "Client", value: (b) => b.passenger_name },
                { label: "Rider", value: (b) => b.provider_name },
                { label: "Prix estimé (FCFA)", value: (b) => b.fare_estimate_xaf },
                { label: "Prix final (FCFA)", value: (b) => b.fare_final_xaf },
                { label: "Paiement", value: (b) => PAYMENT_LABEL[b.payment_method] ?? b.payment_method },
                { label: "Note", value: (b) => b.rating },
              ]}
            />
          ) : tab === "rentals" ? (
            <ExportButton
              name="gobert-locations"
              rows={data?.rentals}
              columns={[
                { label: "Date", value: (r) => r.created_at },
                { label: "Statut", value: (r) => r.status },
                { label: "Véhicule", value: (r) => r.vehicle_label },
                { label: "Client", value: (r) => r.customer_name },
                { label: "Prestataire", value: (r) => r.provider_name },
                { label: "Du", value: (r) => r.start_date },
                { label: "Au", value: (r) => r.end_date },
                { label: "Total (FCFA)", value: (r) => r.total_xaf },
              ]}
            />
          ) : (
            <ExportButton
              name="gobert-colis"
              rows={data?.parcels}
              columns={[
                { label: "Date", value: (p) => p.created_at },
                { label: "Statut", value: (p) => p.status },
                { label: "Expéditeur", value: (p) => p.sender_name },
                { label: "Destinataire", value: (p) => p.receiver_name },
                { label: "Départ", value: (p) => p.pickup?.label },
                { label: "Arrivée", value: (p) => p.dropoff?.label },
                { label: "Taille", value: (p) => p.size },
                { label: "Prix (FCFA)", value: (p) => p.fare_xaf },
                { label: "Coursier", value: (p) => p.provider_name },
              ]}
            />
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        <Pill active={tab === "bookings"} onClick={() => setTab("bookings")}>
          Courses {data ? `(${data.bookings.length})` : ""}
        </Pill>
        <Pill active={tab === "rentals"} onClick={() => setTab("rentals")}>
          Locations {data ? `(${data.rentals.length})` : ""}
        </Pill>
        <Pill active={tab === "parcels"} onClick={() => setTab("parcels")}>
          Colis {data ? `(${data.parcels.length})` : ""}
        </Pill>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {tab === "bookings" && (
              <>
                <thead className="bg-ivory text-left text-xs uppercase tracking-wider text-charcoal/50">
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>Trajet</th>
                    <th className={th}>Véhicule</th>
                    <th className={th}>Rider</th>
                    <th className={th}>Montant</th>
                    <th className={th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.bookings.map((b) => (
                    <tr key={b.id} className="border-t border-grey/60">
                      <td className={`${td} whitespace-nowrap text-charcoal/55`}>{dt(b.created_at)}</td>
                      <td className={td}>
                        <span className="font-semibold">{b.pickup.label}</span> → {b.dropoff.label}
                      </td>
                      <td className={td}>{VEHICLE_LABEL[b.vehicle_type] ?? b.vehicle_type}</td>
                      <td className={td}>{b.provider_name ?? "—"}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {fcfa(b.fare_final_xaf ?? b.fare_estimate_xaf)}
                        <span className="block text-xs text-charcoal/45">{PAYMENT_LABEL[b.payment_method] ?? b.payment_method}</span>
                      </td>
                      <td className={td}>
                        <StatusBadge status={b.status} />
                        {["requested", "accepted", "arriving", "in_progress"].includes(b.status) && (
                          <button
                            onClick={async () => {
                              const r = await cancelTrip(b.id, "Annulée par un administrateur");
                              if (r.ok) getActivity().then(setData);
                            }}
                            className="ml-2 rounded-md border border-red-200 px-2 py-0.5 text-[11px] font-bold text-red-600 hover:bg-red-50"
                          >
                            Annuler
                          </button>
                        )}
                        {b.rating ? <span className="ml-1 text-xs text-orange">{b.rating}★</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === "rentals" && (
              <>
                <thead className="bg-ivory text-left text-xs uppercase tracking-wider text-charcoal/50">
                  <tr>
                    <th className={th}>Demandée le</th>
                    <th className={th}>Véhicule</th>
                    <th className={th}>Client</th>
                    <th className={th}>Période</th>
                    <th className={th}>Total</th>
                    <th className={th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.rentals.map((r) => (
                    <tr key={r.id} className="border-t border-grey/60">
                      <td className={`${td} whitespace-nowrap text-charcoal/55`}>{dt(r.created_at)}</td>
                      <td className={td}>
                        <span className="font-semibold">{r.vehicle_label}</span>
                        <span className="block text-xs text-charcoal/45">{r.provider_name}</span>
                      </td>
                      <td className={td}>{r.customer_name}</td>
                      <td className={`${td} whitespace-nowrap`}>
                        {r.start_date} → {r.end_date}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{fcfa(r.total_xaf)}</td>
                      <td className={td}>
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
            {tab === "parcels" && (
              <>
                <thead className="bg-ivory text-left text-xs uppercase tracking-wider text-charcoal/50">
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>Trajet</th>
                    <th className={th}>Expéditeur → destinataire</th>
                    <th className={th}>Livreur</th>
                    <th className={th}>Montant</th>
                    <th className={th}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.parcels.map((p) => (
                    <tr key={p.id} className="border-t border-grey/60">
                      <td className={`${td} whitespace-nowrap text-charcoal/55`}>{dt(p.created_at)}</td>
                      <td className={td}>
                        {p.pickup.label} → {p.dropoff.label}
                      </td>
                      <td className={td}>
                        {p.sender_name} → {p.receiver_name}
                      </td>
                      <td className={td}>{p.provider_name ?? "—"}</td>
                      <td className={`${td} whitespace-nowrap`}>{fcfa(p.fare_xaf)}</td>
                      <td className={td}>
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
          {data && data[tab].length === 0 && <p className="px-4 py-10 text-center text-sm text-charcoal/45">Rien pour le moment.</p>}
          {!data && <p className="px-4 py-10 text-center text-sm text-charcoal/40">Chargement… (le serveur web doit tourner sur le port 3000)</p>}
        </div>
      </Card>
    </AdminShell>
  );
}
