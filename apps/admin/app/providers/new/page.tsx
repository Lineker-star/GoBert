"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bike, Building2, Loader2, Plus, Save, Trash2 } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { BUSINESS_LABEL, Card, PageTitle, SERVICE_LABEL, VEHICLE_LABEL, cx } from "@/components/ui";
import { createProvider, getProviderDetail, updateProvider, type Kind } from "@/lib/admin-api";

const RIDER_SERVICES: Record<string, string[]> = { moto: ["moto", "express"], taxi: ["ride", "express"], tricycle: ["ride", "express", "cargo"], truck: ["cargo"] };
const BUSINESS_SERVICES = ["express", "rent", "cargo", "logistics", "ride"];
const DEFAULT_PRICE: Record<string, number> = { moto: 300, ride: 500, express: 500, cargo: 2000, rent: 15000, logistics: 5000 };
const DAYS = [
  [1, "Lun"],
  [2, "Mar"],
  [3, "Mer"],
  [4, "Jeu"],
  [5, "Ven"],
  [6, "Sam"],
  [0, "Dim"],
] as const;

type Service = { type: string; title_fr: string; title_en: string; base_price_xaf: number; zones: string[] };
type Fleet = { type: string; brand: string; model: string; plate: string; price_per_day_xaf: number; price_per_hour_xaf: number; deposit_xaf: number; with_driver: boolean; seats: number | null };
type Form = {
  full_name: string;
  phone: string;
  whatsapp: string;
  city: string;
  bio: string;
  accepts_direct_calls: boolean;
  vehicle_type: string;
  brand: string;
  model: string;
  plate: string;
  color: string;
  year: string;
  seats: string;
  payload_kg: string;
  business_name: string;
  business_type: string;
  registration_number: string;
  tax_id: string;
  address: string;
  description: string;
  services: Service[];
  schedule: { days: number[]; start: string; end: string; is_24h: boolean };
  fleet: Fleet[];
};

const EMPTY: Form = {
  full_name: "",
  phone: "+237",
  whatsapp: "",
  city: "Bertoua",
  bio: "",
  accepts_direct_calls: true,
  vehicle_type: "moto",
  brand: "",
  model: "",
  plate: "",
  color: "",
  year: "",
  seats: "",
  payload_kg: "",
  business_name: "",
  business_type: "car_rental",
  registration_number: "",
  tax_id: "",
  address: "",
  description: "",
  services: [{ type: "moto", title_fr: "moto", title_en: "moto", base_price_xaf: 300, zones: ["Bertoua"] }],
  schedule: { days: [1, 2, 3, 4, 5, 6], start: "06:00", end: "21:00", is_24h: false },
  fleet: [],
};

const input = "w-full h-11 rounded-xl border border-grey bg-white px-3 text-sm focus:outline-none focus:border-green focus:ring-4 focus:ring-green/10";

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cx("block space-y-1", wide && "sm:col-span-2")}>
      <span className="text-xs font-bold text-charcoal/60">{label}</span>
      {children}
    </label>
  );
}

export default function NewProviderPage() {
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("rider");
  const [form, setForm] = useState<Form>(EMPTY);
  const [approve, setApprove] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Edit mode: ?edit=<provider id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (!id) return;
    setEditId(id);
    setLoading(true);
    getProviderDetail(id).then((d) => {
      setLoading(false);
      if (!d) return setError("Prestataire introuvable.");
      const p = d.provider;
      setKind(p.kind);
      setForm({
        ...EMPTY,
        full_name: p.kind === "rider" ? p.display_name : d.owner?.full_name ?? "",
        phone: p.phone ?? "",
        whatsapp: p.whatsapp ?? "",
        city: p.city,
        bio: p.bio,
        accepts_direct_calls: p.accepts_direct_calls,
        vehicle_type: p.vehicle?.type ?? "moto",
        brand: p.vehicle?.brand ?? "",
        model: p.vehicle?.model ?? "",
        plate: p.vehicle?.plate ?? "",
        color: p.vehicle?.color ?? "",
        year: p.vehicle?.year ? String(p.vehicle.year) : "",
        seats: p.vehicle?.seats ? String(p.vehicle.seats) : "",
        payload_kg: p.vehicle?.payload_kg ? String(p.vehicle.payload_kg) : "",
        business_name: p.business?.name ?? "",
        business_type: p.business?.type ?? "car_rental",
        registration_number: p.business?.registration_number ?? "",
        tax_id: p.business?.tax_id ?? "",
        address: p.business?.address ?? "",
        description: p.business?.description ?? "",
        services: (p.service_details.length ? p.service_details : p.services.map((s) => ({ type: s, base_price_xaf: DEFAULT_PRICE[s] ?? 500, zones: ["Bertoua"] }))).map((s) => ({
          type: s.type,
          title_fr: s.type,
          title_en: s.type,
          base_price_xaf: s.base_price_xaf,
          zones: s.zones ?? [],
        })),
        schedule: p.schedule,
        fleet: d.fleet.map((v) => ({
          type: v.type,
          brand: v.brand,
          model: v.model,
          plate: v.plate,
          price_per_day_xaf: v.price_per_day_xaf,
          price_per_hour_xaf: v.price_per_hour_xaf ?? 0,
          deposit_xaf: v.deposit_xaf ?? 0,
          with_driver: v.with_driver,
          seats: v.seats ?? null,
        })),
      });
    });
  }, []);

  const allowed = kind === "rider" ? RIDER_SERVICES[form.vehicle_type] ?? [] : BUSINESS_SERVICES;
  const toggleService = (s: string) =>
    set(
      "services",
      form.services.some((x) => x.type === s)
        ? form.services.filter((x) => x.type !== s)
        : [...form.services, { type: s, title_fr: s, title_en: s, base_price_xaf: DEFAULT_PRICE[s] ?? 500, zones: ["Bertoua"] }],
    );

  const switchKind = (k: Kind) => {
    setKind(k);
    set("services", k === "rider" ? [{ type: "moto", title_fr: "moto", title_en: "moto", base_price_xaf: 300, zones: ["Bertoua"] }] : [{ type: "rent", title_fr: "rent", title_en: "rent", base_price_xaf: 15000, zones: ["Bertoua"] }]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const phone = form.phone.replace(/\s/g, "");
    if (!/^\+\d{8,15}$/.test(phone)) return setError("Téléphone au format international requis (ex. +237699000000).");
    if (kind === "rider" && (!form.full_name.trim() || form.plate.trim().length < 4)) return setError("Nom du rider et immatriculation requis.");
    if (kind === "business" && (!form.business_name.trim() || !form.registration_number.trim())) return setError("Raison sociale et numéro RCCM requis.");
    if (form.services.length === 0) return setError("Choisissez au moins un service.");
    const data: Record<string, unknown> = {
      kind,
      full_name: form.full_name.trim() || form.business_name.trim(),
      phone,
      whatsapp: form.whatsapp.trim(),
      city: form.city,
      bio: form.bio,
      accepts_direct_calls: form.accepts_direct_calls,
      services: form.services,
      schedule: form.schedule,
      ...(kind === "rider"
        ? {
            vehicle_type: form.vehicle_type,
            brand: form.brand,
            model: form.model,
            plate: form.plate.toUpperCase(),
            color: form.color,
            year: form.year ? Number(form.year) : undefined,
            seats: form.seats ? Number(form.seats) : undefined,
            payload_kg: form.payload_kg ? Number(form.payload_kg) : undefined,
          }
        : {
            business_name: form.business_name,
            business_type: form.business_type,
            registration_number: form.registration_number,
            tax_id: form.tax_id,
            address: form.address,
            description: form.description,
            fleet: form.fleet,
          }),
    };
    setBusy(true);
    const r = editId ? await updateProvider(editId, data) : await createProvider(kind, data, approve);
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Échec de l'enregistrement.");
    const id = editId ?? (r.data as { id?: string } | undefined)?.id;
    router.push(id ? `/providers/${id}` : "/providers");
  };

  if (loading) {
    return (
      <AdminShell>
        <Loader2 className="w-5 h-5 animate-spin text-green" />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <PageTitle
        title={editId ? "Modifier le prestataire" : "Créer un prestataire"}
        subtitle={
          editId
            ? "Les modifications sont journalisées."
            : "Pour un rider ou une entreprise inscrit(e) au bureau. Le propriétaire récupère ce profil en s'inscrivant avec le même numéro de téléphone."
        }
      />
      <form onSubmit={submit} className="max-w-3xl space-y-5">
        {!editId && (
          <div className="grid grid-cols-2 gap-3">
            {(["rider", "business"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => switchKind(k)}
                className={cx("flex items-center gap-3 rounded-2xl border-2 p-4 text-left", kind === k ? "border-green bg-green/5" : "border-grey bg-white")}
              >
                {k === "rider" ? <Bike className="w-6 h-6 text-orange" /> : <Building2 className="w-6 h-6 text-forest" />}
                <span>
                  <span className="block font-bold">{k === "rider" ? "Rider / propriétaire" : "Prestataire (entreprise)"}</span>
                  <span className="block text-xs text-charcoal/55">{k === "rider" ? "Moto, taxi, tricycle, camion" : "Livraison, location, logistique"}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <Card className="p-5">
          <h2 className="mb-4 font-bold">{kind === "rider" ? "Identité du rider" : "Entreprise"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {kind === "business" && (
              <>
                <F label="Raison sociale *">
                  <input className={input} value={form.business_name} onChange={(e) => set("business_name", e.target.value)} />
                </F>
                <F label="Activité">
                  <select className={input} value={form.business_type} onChange={(e) => set("business_type", e.target.value)}>
                    {Object.entries(BUSINESS_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </F>
                <F label="Numéro RCCM *">
                  <input className={input} value={form.registration_number} onChange={(e) => set("registration_number", e.target.value)} />
                </F>
                <F label="NIU">
                  <input className={input} value={form.tax_id} onChange={(e) => set("tax_id", e.target.value)} />
                </F>
                <F label="Adresse / repère" wide>
                  <input className={input} value={form.address} onChange={(e) => set("address", e.target.value)} />
                </F>
              </>
            )}
            <F label={kind === "rider" ? "Nom complet *" : "Nom du responsable"}>
              <input className={input} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </F>
            <F label="Téléphone (sert à rattacher le compte) *">
              <input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
            </F>
            <F label="WhatsApp">
              <input className={input} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" />
            </F>
            <F label="Ville">
              <input className={input} value={form.city} onChange={(e) => set("city", e.target.value)} />
            </F>
            <F label="Présentation" wide>
              <textarea className={`${input} h-20 py-2`} value={kind === "rider" ? form.bio : form.description} onChange={(e) => set(kind === "rider" ? "bio" : "description", e.target.value)} />
            </F>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.accepts_direct_calls} onChange={(e) => set("accepts_direct_calls", e.target.checked)} className="h-4 w-4 accent-[#087C55]" />
              Les clients connectés peuvent l&apos;appeler directement
            </label>
          </div>
        </Card>

        {kind === "rider" && (
          <Card className="p-5">
            <h2 className="mb-4 font-bold">Véhicule</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <F label="Type">
                <select
                  className={input}
                  value={form.vehicle_type}
                  onChange={(e) => {
                    set("vehicle_type", e.target.value);
                    const first = RIDER_SERVICES[e.target.value][0];
                    set("services", [{ type: first, title_fr: first, title_en: first, base_price_xaf: DEFAULT_PRICE[first], zones: ["Bertoua"] }]);
                  }}
                >
                  {Object.keys(RIDER_SERVICES).map((v) => (
                    <option key={v} value={v}>
                      {VEHICLE_LABEL[v]}
                    </option>
                  ))}
                </select>
              </F>
              <F label="Marque">
                <input className={input} value={form.brand} onChange={(e) => set("brand", e.target.value)} />
              </F>
              <F label="Modèle">
                <input className={input} value={form.model} onChange={(e) => set("model", e.target.value)} />
              </F>
              <F label="Immatriculation *">
                <input className={input} value={form.plate} onChange={(e) => set("plate", e.target.value.toUpperCase())} />
              </F>
              <F label="Couleur">
                <input className={input} value={form.color} onChange={(e) => set("color", e.target.value)} />
              </F>
              <F label="Année">
                <input className={input} value={form.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" />
              </F>
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="mb-4 font-bold">Services & tarifs</h2>
          <div className="space-y-2">
            {allowed.map((s) => {
              const svc = form.services.find((x) => x.type === s);
              return (
                <div key={s} className={cx("rounded-xl border p-3", svc ? "border-green/40 bg-green/5" : "border-grey")}>
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={!!svc} onChange={() => toggleService(s)} className="h-4 w-4 accent-[#087C55]" />
                    GoBert {SERVICE_LABEL[s]}
                  </label>
                  {svc && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input
                        className={input}
                        type="number"
                        min={0}
                        value={svc.base_price_xaf}
                        onChange={(e) => set("services", form.services.map((x) => (x.type === s ? { ...x, base_price_xaf: Math.max(0, Number(e.target.value)) } : x)))}
                        aria-label="Prix (FCFA)"
                      />
                      <input
                        className={input}
                        value={svc.zones.join(", ")}
                        onChange={(e) => set("services", form.services.map((x) => (x.type === s ? { ...x, zones: e.target.value.split(",").map((z) => z.trim()).filter(Boolean) } : x)))}
                        aria-label="Zones"
                        placeholder="Zones (virgules)"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-bold">Horaires</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.schedule.is_24h} onChange={(e) => set("schedule", { ...form.schedule, is_24h: e.target.checked })} className="h-4 w-4 accent-[#087C55]" />
            Disponible 24h/24, 7j/7
          </label>
          {!form.schedule.is_24h && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {DAYS.map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set("schedule", { ...form.schedule, days: form.schedule.days.includes(d) ? form.schedule.days.filter((x) => x !== d) : [...form.schedule.days, d] })}
                  className={cx("h-9 w-12 rounded-lg text-xs font-bold", form.schedule.days.includes(d) ? "bg-green text-white" : "border border-grey bg-white")}
                >
                  {label}
                </button>
              ))}
              <input type="time" className={`${input} w-28`} value={form.schedule.start} onChange={(e) => set("schedule", { ...form.schedule, start: e.target.value })} />
              <span>→</span>
              <input type="time" className={`${input} w-28`} value={form.schedule.end} onChange={(e) => set("schedule", { ...form.schedule, end: e.target.value })} />
            </div>
          )}
        </Card>

        {kind === "business" && (
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Flotte de location ({form.fleet.length})</h2>
              <button
                type="button"
                onClick={() => set("fleet", [...form.fleet, { type: "car", brand: "", model: "", plate: "", price_per_day_xaf: 15000, price_per_hour_xaf: 3000, deposit_xaf: 30000, with_driver: true, seats: 5 }])}
                className="inline-flex h-9 items-center gap-1 rounded-xl bg-green/10 px-3 text-sm font-bold text-green"
              >
                <Plus className="w-4 h-4" /> Véhicule
              </button>
            </div>
            <div className="space-y-3">
              {form.fleet.map((v, i) => {
                const upd = (p: Partial<Fleet>) => set("fleet", form.fleet.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <div key={i} className="grid gap-2 rounded-xl border border-grey p-3 sm:grid-cols-4">
                    <select className={input} value={v.type} onChange={(e) => upd({ type: e.target.value })}>
                      {["car", "van", "truck", "moto", "tricycle"].map((ty) => (
                        <option key={ty} value={ty}>
                          {VEHICLE_LABEL[ty] ?? ty}
                        </option>
                      ))}
                    </select>
                    <input className={input} placeholder="Marque" value={v.brand} onChange={(e) => upd({ brand: e.target.value })} />
                    <input className={input} placeholder="Modèle" value={v.model} onChange={(e) => upd({ model: e.target.value })} />
                    <input className={input} placeholder="Plaque" value={v.plate} onChange={(e) => upd({ plate: e.target.value.toUpperCase() })} />
                    <input className={input} type="number" placeholder="Prix/jour" value={v.price_per_day_xaf} onChange={(e) => upd({ price_per_day_xaf: Number(e.target.value) })} aria-label="Prix par jour" />
                    <input className={input} type="number" placeholder="Prix/heure" value={v.price_per_hour_xaf} onChange={(e) => upd({ price_per_hour_xaf: Number(e.target.value) })} aria-label="Prix par heure" />
                    <input className={input} type="number" placeholder="Caution" value={v.deposit_xaf} onChange={(e) => upd({ deposit_xaf: Number(e.target.value) })} aria-label="Caution" />
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={v.with_driver} onChange={(e) => upd({ with_driver: e.target.checked })} className="accent-[#087C55]" /> Chauffeur
                      </label>
                      <button type="button" onClick={() => set("fleet", form.fleet.filter((_, j) => j !== i))} className="p-2 text-charcoal/40 hover:text-red-600" aria-label="Retirer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {!editId && (
          <label className="flex items-start gap-3 rounded-2xl bg-white border border-grey p-4 text-sm">
            <input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#087C55]" />
            <span>
              <span className="font-bold">Valider immédiatement</span> — documents vérifiés au bureau. Les services seront visibles par les clients dès l&apos;enregistrement.
            </span>
          </label>
        )}

        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={busy} className="inline-flex h-12 items-center gap-2 rounded-xl bg-green px-6 text-sm font-bold text-white hover:bg-green-dark disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {editId ? "Enregistrer les modifications" : approve ? "Créer et valider" : "Créer (en attente)"}
        </button>
      </form>
    </AdminShell>
  );
}
