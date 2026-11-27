"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Camera, CircleCheck, Package, Truck, X } from "lucide-react";
import AppShell from "@/components/ui/AppShell";
import { Alert, Badge, Button, Card, Field, Input, PageLoader, RouteLine, STATUS_TONE, Textarea, cx } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { createParcel, getParcel } from "@/lib/api";
import { compressImage } from "@/lib/image-compress";
import { BERTOUA_PLACES } from "@/lib/constants";
import { formatDate, formatXAF } from "@/lib/format";
import type { ExpressParcel, ParcelSize } from "@/lib/mock-store";

const SIZES: { key: ParcelSize; base: number }[] = [
  { key: "small", base: 500 },
  { key: "medium", base: 1000 },
  { key: "large", base: 2000 },
];
const FLOW = ["requested", "accepted", "in_transit", "delivered"] as const;

/** Resolve a typed landmark to coordinates using the known Bertoua places (fallback: centre). */
function resolve(label: string) {
  const l = label.trim().toLowerCase();
  const hit = BERTOUA_PLACES.find((p) => p.label.toLowerCase() === l || l.includes(p.label.toLowerCase()));
  const c = hit ?? BERTOUA_PLACES[0];
  return { lat: c.lat, lng: c.lng, label: label.trim() };
}

export default function ExpressPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { session, user, profile, signInAnonymous } = useAuth();
  const [parcelId, setParcelId] = useState<string | null>(null);
  const [parcel, setParcel] = useState<ExpressParcel | null>(null);
  const [checked, setChecked] = useState(false);

  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [from, setFrom] = useState("Bertoua Centre");
  const [to, setTo] = useState("");
  const [size, setSize] = useState<ParcelSize>("small");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setParcelId(id);
    setChecked(true);
  }, []);

  useEffect(() => {
    if (profile) {
      setSenderName(profile.full_name);
      setSenderPhone(profile.phone);
    }
  }, [profile]);

  useEffect(() => {
    if (!parcelId) return;
    const load = () => getParcel(parcelId, user?.id).then(setParcel).catch(() => undefined);
    void load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [parcelId, user?.id]);

  const submit = async () => {
    if (!senderName.trim() || !receiverName.trim()) return setError(t("express.namesRequired"));
    if (senderPhone.replace(/\D/g, "").length < 8 || receiverPhone.replace(/\D/g, "").length < 8) return setError(t("express.phonesRequired"));
    if (!from.trim() || !to.trim()) return setError(t("express.placesRequired"));
    setBusy(true);
    setError(null);
    try {
      let uid = user?.id ?? null;
      if (!session) {
        const g = await signInAnonymous();
        if (g.error) throw new Error(g.error);
        uid = g.userId ?? null;
      }
      const p = await createParcel({
        sender_user_id: uid,
        sender_name: senderName.trim(),
        sender_phone: senderPhone.trim(),
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        pickup: resolve(from),
        dropoff: resolve(to),
        size,
        notes: notes.trim() || undefined,
        photo,
      });
      setParcel(p);
      setParcelId(p.id);
      window.history.replaceState(null, "", `/${locale}/express?id=${p.id}`);
    } catch (e) {
      setError(e instanceof Error && e.message === "captcha_failed" ? t("auth.errors.captcha_failed") : t("common.networkError"));
    } finally {
      setBusy(false);
    }
  };

  if (!checked || (parcelId && !parcel)) return <PageLoader label={t("common.loading")} />;

  if (parcel) {
    const idx = FLOW.indexOf(parcel.status as (typeof FLOW)[number]);
    return (
      <AppShell title={t("express.title")} back="/trips?tab=parcels">
        <div className="mx-auto max-w-md space-y-4">
          <Card className="p-6 text-center">
            <span className={cx("mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white", parcel.status === "delivered" ? "bg-green" : "bg-orange")}>
              {parcel.status === "delivered" ? <CircleCheck className="w-8 h-8" /> : <Package className="w-8 h-8" />}
            </span>
            <h1 className="mt-4 text-xl font-extrabold">{t(`express.statusTitle.${parcel.status}`)}</h1>
            <Badge tone={STATUS_TONE[parcel.status]} className="mt-2">
              {t(`status.${parcel.status}`)}
            </Badge>
            <ol className="mt-5 flex items-center gap-1.5">
              {FLOW.map((s, i) => (
                <li key={s} className="flex-1">
                  <span className={cx("block h-1.5 rounded-full", i <= idx ? "bg-green" : "bg-grey")} />
                  <span className={cx("mt-1 block text-[10px] font-semibold", i <= idx ? "text-green" : "text-charcoal/40")}>{t(`status.${s}`)}</span>
                </li>
              ))}
            </ol>
            {parcel.otp && parcel.status !== "delivered" && (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-green/40 bg-green/5 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-charcoal/55">{t("express.otp")}</p>
                <p className="mt-1 font-mono text-4xl font-extrabold tracking-[0.3em] text-green">{parcel.otp}</p>
                <p className="mt-1 text-xs text-charcoal/55">{t("express.otpHint")}</p>
              </div>
            )}
          </Card>
          <Card className="p-4 space-y-3">
            <RouteLine from={parcel.pickup.label} to={parcel.dropoff.label} fromLabel={t("express.from")} toLabel={t("express.to")} />
            <div className="flex justify-between border-t border-grey pt-3 text-sm">
              <span className="text-charcoal/55">
                {t(`parcelSizes.${parcel.size}.name`)} · {parcel.receiver_name}
              </span>
              <span className="font-extrabold text-green">{formatXAF(parcel.fare_xaf, locale)}</span>
            </div>
            <p className="text-xs text-charcoal/45">{formatDate(parcel.created_at, locale, true)}</p>
          </Card>
          <Button
            variant="outline"
            block
            onClick={() => {
              setParcel(null);
              setParcelId(null);
              setReceiverName("");
              setReceiverPhone("");
              setTo("");
              window.history.replaceState(null, "", `/${locale}/express`);
            }}
          >
            {t("express.newParcel")}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("express.title")}>
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-orange p-6 text-white">
          <Truck className="absolute -right-6 -bottom-8 h-40 w-40 text-white/15" aria-hidden />
          <p className="relative text-2xl font-extrabold text-white">{t("express.headline")}</p>
          <p className="relative mt-1 max-w-md text-sm text-white/85">{t("express.subtitle")}</p>
        </div>

        <Card className="p-5 space-y-4">
          <p className="font-bold">{t("express.route")}</p>
          <Field label={t("express.from")}>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} list="gb-places" placeholder={t("express.pickupPlaceholder")} />
          </Field>
          <Field label={t("express.to")}>
            <Input value={to} onChange={(e) => setTo(e.target.value)} list="gb-places" placeholder={t("express.dropoffPlaceholder")} />
          </Field>
          <datalist id="gb-places">
            {BERTOUA_PLACES.map((p) => (
              <option key={p.key} value={p.label} />
            ))}
          </datalist>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="p-5 space-y-3">
            <p className="font-bold">{t("express.sender")}</p>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder={t("express.name")} autoComplete="name" />
            <Input value={senderPhone} onChange={(e) => setSenderPhone(e.target.value)} placeholder="+237 6…" type="tel" />
          </Card>
          <Card className="p-5 space-y-3">
            <p className="font-bold">{t("express.receiver")}</p>
            <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder={t("express.name")} />
            <Input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} placeholder="+237 6…" type="tel" />
          </Card>
        </div>

        <Card className="p-5 space-y-4">
          <p className="font-bold">{t("express.size")}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {SIZES.map((s) => (
              <button
                key={s.key}
                role="radio"
                aria-checked={size === s.key}
                onClick={() => setSize(s.key)}
                className={cx(
                  "rounded-2xl border-2 p-3 text-left transition",
                  size === s.key ? "border-green bg-green text-white" : "border-grey bg-white hover:border-green/40",
                )}
              >
                <Package className={cx(s.key === "small" ? "w-5 h-5" : s.key === "medium" ? "w-6 h-6" : "w-7 h-7")} />
                <span className="mt-1 block text-sm font-bold">{t(`parcelSizes.${s.key}.name`)}</span>
                <span className={cx("block text-[11px]", size === s.key ? "text-white/80" : "text-charcoal/55")}>{t(`parcelSizes.${s.key}.desc`)}</span>
                <span className="mt-1 block text-xs font-extrabold">{t("profile.from", { price: formatXAF(s.base, locale) })}</span>
              </button>
            ))}
          </div>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))} placeholder={t("express.notesPlaceholder")} className="min-h-[64px]" />
          {photo ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="h-16 w-16 rounded-xl object-cover" />
              <Button variant="ghost" size="sm" onClick={() => setPhoto(null)}>
                <X className="w-4 h-4" /> {t("common.remove")}
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-charcoal/60 hover:text-green">
              <Camera className="w-4 h-4" /> {t("express.addPhoto")}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto((await compressImage(f, 120 * 1024, 800)).dataUrl);
                }}
              />
            </label>
          )}
        </Card>

        {error && <Alert tone="red">{error}</Alert>}
        <Button block size="lg" variant="accent" onClick={submit} loading={busy}>
          {t("express.send")}
        </Button>
        <p className="text-center text-xs text-charcoal/50">{t("express.fareNote")}</p>
      </div>
    </AppShell>
  );
}
