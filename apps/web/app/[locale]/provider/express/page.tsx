"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getParcels, acceptParcel, deliverParcel } from "@/lib/rent-express-api";
import type { ExpressParcel } from "@/lib/mock-store";

const PROVIDER_ID = "00000000-0000-0000-0000-000000000001";

export default function ProviderExpressPage() {
  const t = useTranslations();
  const [parcels, setParcels] = useState<ExpressParcel[]>([]);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getParcels().then(setParcels);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  const accept = async (id: string) => {
    await acceptParcel(id, PROVIDER_ID);
    load();
  };

  const deliver = async (id: string) => {
    const otp = otpInputs[id] ?? "";
    const ok = await deliverParcel(id, otp);
    if (!ok) {
      setError(t("express.wrongOtp"));
    } else {
      setError(null);
      load();
    }
  };

  return (
    <div className="min-h-screen bg-ivory p-4">
      <div className="max-w-sm mx-auto space-y-4">
        <h1 className="text-xl font-bold text-green">{t("express.title")}</h1>
        {error && <p className="text-xs text-orange">{error}</p>}
        {parcels.length === 0 && <p className="text-sm text-charcoal/40 text-center mt-10">{t("express.noParcels")}</p>}
        {parcels.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium text-charcoal">
                {p.sender_name} → {p.receiver_name}
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green/10 text-green">{p.status}</span>
            </div>
            <div className="text-xs text-charcoal/50 mt-1">
              {p.pickup.label} → {p.dropoff.label} · {p.size}
            </div>
            <div className="text-sm font-semibold text-green mt-1">{p.fare_xaf.toLocaleString()} XAF</div>
            {p.status === "requested" && (
              <button onClick={() => accept(p.id)} className="w-full mt-3 bg-green text-white rounded-xl py-2 text-sm font-semibold">
                {t("provider.accept")}
              </button>
            )}
            {p.status === "accepted" && (
              <div className="flex gap-2 mt-3">
                <input
                  value={otpInputs[p.id] ?? ""}
                  onChange={(e) => setOtpInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={t("express.otp")}
                  className="flex-1 border border-grey rounded-xl px-3 py-2 text-sm"
                />
                <button onClick={() => deliver(p.id)} className="bg-orange text-white rounded-xl px-4 py-2 text-sm font-semibold">
                  {t("express.deliver")}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}