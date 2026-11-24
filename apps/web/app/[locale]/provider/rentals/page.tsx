"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getRentalRequests, respondRental } from "@/lib/rent-express-api";
import type { RentalRequest } from "@/lib/mock-store";

const PROVIDER_ID = "00000000-0000-0000-0000-000000000001";

const STATUS_LABEL: Record<string, string> = {
  requested: "Nouvelle demande",
  confirmed: "Confirmé",
  declined: "Refusé",
  active: "En cours",
  completed: "Terminé",
};

export default function ProviderRentalsPage() {
  const t = useTranslations();
  const [requests, setRequests] = useState<RentalRequest[]>([]);

  const load = useCallback(() => {
    getRentalRequests(PROVIDER_ID).then(setRequests);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  const act = async (id: string, confirm: boolean) => {
    await respondRental(id, confirm);
    load();
  };

  return (
    <div className="min-h-screen bg-ivory p-4">
      <div className="max-w-sm mx-auto space-y-4">
        <h1 className="text-xl font-bold text-green">{t("provider.rentals")}</h1>
        {requests.length === 0 && <p className="text-sm text-charcoal/40 text-center mt-10">{t("provider.noRentals")}</p>}
        {requests.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium text-charcoal">{r.customer_name}</div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green/10 text-green">{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
            <div className="text-xs text-charcoal/50 mt-1">
              {r.start_date} → {r.end_date} · {r.with_driver ? t("rent.withDriver") : t("rent.noDriver")}
            </div>
            {r.status === "requested" && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => act(r.id, false)} className="flex-1 border border-grey rounded-xl py-2 text-sm text-charcoal">
                  {t("provider.decline")}
                </button>
                <button onClick={() => act(r.id, true)} className="flex-1 bg-green text-white rounded-xl py-2 text-sm font-semibold">
                  {t("provider.accept")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}