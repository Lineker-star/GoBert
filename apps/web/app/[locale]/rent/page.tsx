"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Truck, Car, Bus } from "lucide-react";
import { getRentals, createRentalRequest, getRentalRequest } from "@/lib/rent-express-api";
import type { RentalVehicle, RentalRequest } from "@/lib/mock-store";

const TYPE_ICON = { car: Car, truck: Truck, van: Bus };

export default function RentPage() {
  const t = useTranslations();
  const [vehicles, setVehicles] = useState<RentalVehicle[]>([]);
  const [selected, setSelected] = useState<RentalVehicle | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [withDriver, setWithDriver] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRentals().then(setVehicles);
  }, []);

  // poll request status
  const requestId = request?.id ?? null;
  useEffect(() => {
    if (!requestId) return;
    const id = setInterval(() => {
      getRentalRequest(requestId).then((r) => r && setRequest(r));
    }, 2000);
    return () => clearInterval(id);
  }, [requestId]);

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    const req = await createRentalRequest({
      vehicle_id: selected.id,
      customer_name: name || "Client",
      phone,
      start_date: startDate,
      end_date: endDate,
      with_driver: withDriver,
    });
    setRequest(req);
    setBusy(false);
  };

  const reset = () => {
    setSelected(null);
    setRequest(null);
    setStartDate("");
    setEndDate("");
  };

  const STATUS_LABEL: Record<string, string> = {
    requested: "En attente de confirmation",
    confirmed: "Confirmé",
    declined: "Refusé",
    active: "En cours",
    completed: "Terminé",
  };

  if (request) {
    return (
      <div className="min-h-screen bg-ivory p-4">
        <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-sm p-6 text-center">
          <div className="text-5xl mb-3">{request.status === "confirmed" ? "✅" : request.status === "declined" ? "❌" : "⏳"}</div>
          <h2 className="text-lg font-bold text-charcoal">{STATUS_LABEL[request.status] ?? request.status}</h2>
          <p className="text-sm text-charcoal/50 mt-2">
            {selected?.brand} {selected?.model} · {request.start_date} → {request.end_date}
          </p>
          {request.status === "requested" && (
            <p className="text-xs text-orange mt-3">{t("rent.pendingHint")}</p>
          )}
          <button onClick={reset} className="mt-4 border border-grey rounded-xl px-4 py-2 text-sm">
            {t("rent.newRequest")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory p-4">
      <div className="max-w-sm mx-auto space-y-4">
        <h1 className="text-xl font-bold text-green">{t("rent.title")}</h1>
        {vehicles.map((v) => {
          const Icon = TYPE_ICON[v.type];
          return (
            <div key={v.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.photo} alt="" className="w-full h-32 object-cover" />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <Icon className="w-5 h-5 text-green" />
                  <div className="font-bold text-charcoal">
                    {v.brand} {v.model}
                  </div>
                </div>
                <div className="text-xs text-charcoal/50 mt-1">{v.plate}</div>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <div className="text-sm font-semibold text-green">{v.price_per_day_xaf.toLocaleString()} XAF / jour</div>
                    <div className="text-xs text-charcoal/50">{v.price_per_hour_xaf.toLocaleString()} XAF / heure</div>
                    <div className="text-xs text-charcoal/40 mt-1">
                      {t("rent.deposit")}: {v.deposit_xaf.toLocaleString()} XAF
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelected(v);
                      setWithDriver(v.with_driver);
                    }}
                    className="bg-green text-white rounded-xl px-4 py-2 text-sm font-semibold"
                  >
                    {t("rent.request")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {selected && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5">
              <h2 className="text-base font-bold text-green mb-3">
                {t("rent.request")} — {selected.brand} {selected.model}
              </h2>
              <div className="space-y-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("rent.name")} className={inputCls} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237 6 99 00 00 01" className={inputCls} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
                <label className="flex items-center gap-2 text-sm text-charcoal">
                  <input type="checkbox" checked={withDriver} onChange={(e) => setWithDriver(e.target.checked)} />
                  {t("rent.withDriver")}
                </label>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setSelected(null)} className="flex-1 border border-grey rounded-xl py-2.5 text-sm">
                  {t("rent.cancel")}
                </button>
                <button onClick={submit} disabled={busy || !startDate || !endDate} className="flex-1 bg-green text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                  {t("rent.submit")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls = "w-full border border-grey rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green";