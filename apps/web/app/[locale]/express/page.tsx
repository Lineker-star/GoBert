"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Upload } from "lucide-react";
import { createParcel, getParcel } from "@/lib/rent-express-api";
import { compressImage } from "@/lib/image-compress";
import type { ExpressParcel, ParcelSize } from "@/lib/mock-store";
import { BERTOUA } from "@/lib/supabase";

const SIZES: { key: ParcelSize; label: string }[] = [
  { key: "small", label: "Petit" },
  { key: "medium", label: "Moyen" },
  { key: "large", label: "Grand" },
];

const FARE: Record<ParcelSize, number> = { small: 500, medium: 1000, large: 2000 };

export default function ExpressPage() {
  const t = useTranslations();
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [size, setSize] = useState<ParcelSize>("small");
  const [photo, setPhoto] = useState<string | null>(null);
  const [dropoffLabel, setDropoffLabel] = useState("Mokolo");
  const [parcel, setParcel] = useState<ExpressParcel | null>(null);
  const [busy, setBusy] = useState(false);

  const parcelId = parcel?.id ?? null;
  useEffect(() => {
    if (!parcelId) return;
    const id = setInterval(() => {
      getParcel(parcelId).then((p) => p && setParcel(p));
    }, 2000);
    return () => clearInterval(id);
  }, [parcelId]);

  const onPhoto = async (file: File) => {
    const c = await compressImage(file);
    setPhoto(c.dataUrl);
  };

  const submit = async () => {
    setBusy(true);
    const p = await createParcel({
      sender_name: senderName || "Expéditeur",
      sender_phone: senderPhone,
      receiver_name: receiverName || "Destinataire",
      receiver_phone: receiverPhone,
      pickup: { ...BERTOUA, label: "Bertoua Centre" },
      dropoff: { lat: 4.59, lng: 13.7, label: dropoffLabel || "Mokolo" },
      size,
      photo,
    });
    setParcel(p);
    setBusy(false);
  };

  const STATUS_LABEL: Record<string, string> = {
    requested: "En attente d'un livreur",
    accepted: "Livreur assigné",
    in_transit: "En transit",
    delivered: "Livré",
    cancelled: "Annulé",
  };

  if (parcel) {
    return (
      <div className="min-h-screen bg-ivory p-4">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="text-5xl mb-3">{parcel.status === "delivered" ? "✅" : "📦"}</div>
            <h2 className="text-lg font-bold text-charcoal">{STATUS_LABEL[parcel.status] ?? parcel.status}</h2>
            <div className="mt-4 bg-green/10 rounded-xl p-3">
              <div className="text-xs text-charcoal/50 uppercase">{t("express.otp")}</div>
              <div className="text-3xl font-bold text-green tracking-widest">{parcel.otp}</div>
              <div className="text-xs text-charcoal/40 mt-1">{t("express.otpHint")}</div>
            </div>
            <div className="mt-4 text-sm text-charcoal/60">
              {parcel.sender_name} → {parcel.receiver_name}
            </div>
            <div className="text-lg font-bold text-green mt-1">{parcel.fare_xaf.toLocaleString()} XAF</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ivory p-4">
      <div className="max-w-sm mx-auto space-y-4">
        <h1 className="text-xl font-bold text-green">{t("express.title")}</h1>

        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider">{t("express.sender")}</h2>
          <input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder={t("express.name")} className={inputCls} />
          <input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="+237 6 99 00 00 01" className={inputCls} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider">{t("express.receiver")}</h2>
          <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder={t("express.name")} className={inputCls} />
          <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="+237 6 99 00 00 01" className={inputCls} />
          <input value={dropoffLabel} onChange={(e) => setDropoffLabel(e.target.value)} placeholder={t("express.destination")} className={inputCls} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider mb-3">{t("express.size")}</h2>
          <div className="flex gap-2">
            {SIZES.map((s) => (
              <button
                key={s.key}
                onClick={() => setSize(s.key)}
                className={`flex-1 rounded-xl border py-2 text-sm ${size === s.key ? "bg-green border-green text-green" : "border-grey text-charcoal"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 mt-3 text-sm text-charcoal/60 cursor-pointer">
            <Upload className="w-4 h-4" />
            {photo ? t("express.photoAdded") : t("express.addPhoto")}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
          </label>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs text-charcoal/50 uppercase">{t("express.fare")}</div>
            <div className="text-2xl font-bold text-green">{FARE[size].toLocaleString()} XAF</div>
          </div>
          <button onClick={submit} disabled={busy} className="bg-orange text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
            {t("express.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-grey rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green";