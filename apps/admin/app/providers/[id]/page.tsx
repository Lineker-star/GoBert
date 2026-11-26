"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, Building2, Check, FileText, Loader2, MessageCircle, Pencil, Phone, ShieldCheck, X } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import {
  BUSINESS_LABEL,
  Card,
  DOC_LABEL,
  Initials,
  KIND_LABEL,
  SERVICE_LABEL,
  StatusBadge,
  VEHICLE_LABEL,
  cx,
  dt,
  fcfa,
} from "@/components/ui";
import Link from "next/link";
import { decide, documentUrl, getProviderDetail, type Decision, type Doc, type ProviderDetail } from "@/lib/admin-api";

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const REQUIRED_DOCS: Record<string, string[]> = {
  rider: ["id_card", "license", "registration"],
  business: ["business_registration", "manager_id"],
};
const CHECKLIST: Record<string, string[]> = {
  rider: [
    "La CNI est lisible et correspond au nom déclaré",
    "Le permis de conduire est valide pour ce type de véhicule",
    "La carte grise correspond à l'immatriculation déclarée",
    "Les tarifs et zones sont cohérents",
  ],
  business: [
    "Le RCCM est valide et correspond au nom de l'entreprise",
    "La CNI du gérant est lisible",
    "Les services déclarés correspondent à l'activité",
    "Les véhicules de location sont cohérents (prix, plaques)",
  ],
};
const DECISION_STATUS: Record<string, string> = { approve: "approved", reject: "rejected", request_changes: "changes_requested", suspend: "suspended" };

export default function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<ProviderDetail | null | undefined>(undefined);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null);

  const load = useCallback(() => getProviderDetail(id).then((d) => setDetail(d)), [id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (detail) setChecked(new Array(CHECKLIST[detail.provider.kind].length).fill(false));
  }, [detail?.provider.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const missingDocs = useMemo(() => {
    if (!detail) return [];
    const have = new Set(detail.documents.map((d) => d.type));
    return REQUIRED_DOCS[detail.provider.kind].filter((d) => !have.has(d));
  }, [detail]);

  if (detail === undefined) {
    return (
      <AdminShell>
        <div className="flex items-center gap-2 text-charcoal/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
        </div>
      </AdminShell>
    );
  }
  if (detail === null) {
    return (
      <AdminShell>
        <p className="text-charcoal/60">Dossier introuvable.</p>
      </AdminShell>
    );
  }

  const { provider: p, documents, owner, fleet, audit } = detail;
  const allChecked = checked.length > 0 && checked.every(Boolean);
  const seeded = !p.owner_user_id;

  const act = async (decision: Decision) => {
    setError(null);
    if (decision !== "approve" && !reason.trim()) {
      setError("Un motif est obligatoire pour cette décision : il sera envoyé au demandeur.");
      return;
    }
    if (decision === "approve" && !allChecked && !seeded) {
      setError("Cochez tous les points de contrôle avant d'approuver.");
      return;
    }
    setBusy(decision);
    const r = await decide(p.id, decision, decision === "approve" ? null : reason.trim());
    setBusy(null);
    if (!r.ok) return setError(r.error === "network" ? "Serveur injoignable." : r.error ?? "Erreur");
    setReason("");
    setFlash(
      decision === "approve"
        ? "Approuvé — les services sont maintenant visibles par les clients."
        : decision === "suspend"
          ? "Suspendu — masqué des clients."
          : "Décision enregistrée et envoyée au demandeur.",
    );
    void load();
  };

  return (
    <AdminShell>
      <button onClick={() => router.push("/providers")} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-charcoal/60 hover:text-green">
        <ArrowLeft className="w-4 h-4" /> Retour à la file
      </button>

      {/* Header */}
      <Card className="p-5 flex flex-wrap items-center gap-4">
        {p.kind === "business" ? (
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-white">
            <Building2 className="w-7 h-7" />
          </span>
        ) : p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <Initials name={p.display_name} size={56} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold">{p.display_name}</h1>
            <StatusBadge status={p.verification_status} />
            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${p.kind === "rider" ? "bg-orange/15 text-[#B25E0B]" : "bg-forest/10 text-forest"}`}>{KIND_LABEL[p.kind]}</span>
          </div>
          <p className="mt-1 text-sm text-charcoal/55">
            Soumis le {dt(p.submitted_at)} · {p.city}
            {p.reviewed_at ? ` · examiné le ${dt(p.reviewed_at)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/providers/new?edit=${p.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-3 text-sm font-semibold text-white hover:bg-charcoal">
            <Pencil className="w-4 h-4" /> Modifier
          </Link>
          <a href={`tel:${p.phone}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-grey bg-white px-3 text-sm font-semibold hover:border-green/40">
            <Phone className="w-4 h-4" /> {p.phone}
          </a>
          {p.whatsapp && (
            <a href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-grey bg-white px-3 text-sm font-semibold hover:border-green/40">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
        </div>
      </Card>

      {flash && <p className="mt-4 rounded-xl bg-green/10 px-4 py-3 text-sm font-semibold text-green">{flash}</p>}
      {p.review_note && p.verification_status !== "approved" && (
        <p className="mt-4 rounded-xl bg-orange/10 px-4 py-3 text-sm">
          <span className="font-bold">Dernier motif envoyé : </span>
          {p.review_note}
        </p>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {/* Details */}
          <Card className="p-5">
            <h2 className="mb-4 font-bold">{p.kind === "rider" ? "Rider & véhicule" : "Entreprise"}</h2>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              {owner && <Row label="Compte" value={`${owner.full_name} · ${owner.phone}${owner.email ? ` · ${owner.email}` : ""}`} />}
              {p.vehicle && (
                <>
                  <Row label="Véhicule" value={`${VEHICLE_LABEL[p.vehicle.type] ?? p.vehicle.type} — ${p.vehicle.brand} ${p.vehicle.model}`} />
                  <Row label="Immatriculation" value={p.vehicle.plate} mono />
                  <Row label="Couleur / année" value={`${p.vehicle.color || "—"} · ${p.vehicle.year ?? "—"}`} />
                  <Row label={p.vehicle.payload_kg ? "Charge utile" : "Places"} value={String(p.vehicle.payload_kg ? `${p.vehicle.payload_kg} kg` : p.vehicle.seats ?? "—")} />
                </>
              )}
              {p.business && (
                <>
                  <Row label="Raison sociale" value={p.business.name} />
                  <Row label="Activité" value={BUSINESS_LABEL[p.business.type] ?? p.business.type} />
                  <Row label="RCCM" value={p.business.registration_number || "—"} mono />
                  <Row label="NIU" value={p.business.tax_id || "—"} mono />
                  <Row label="Adresse" value={p.business.address || "—"} />
                </>
              )}
              <Row label="Appels directs" value={p.accepts_direct_calls ? "Autorisés (numéro public)" : "Non — via l'app uniquement"} />
              <Row
                label="Horaires"
                value={p.schedule.is_24h ? "24h/24, 7j/7" : `${DAY_ORDER.filter((d) => p.schedule.days.includes(d)).map((d) => DAYS[d]).join(" ")} · ${p.schedule.start}–${p.schedule.end}`}
              />
              {p.bio && <Row label="Présentation" value={p.bio} wide />}
            </dl>
          </Card>

          {/* Services */}
          <Card className="p-5">
            <h2 className="mb-3 font-bold">Services & tarifs</h2>
            <div className="flex flex-wrap gap-2">
              {(p.service_details.length ? p.service_details : p.services.map((s) => ({ type: s, base_price_xaf: 0, zones: [] as string[] }))).map((s) => (
                <div key={s.type} className="rounded-xl border border-grey px-3 py-2 text-sm">
                  <p className="font-bold">{SERVICE_LABEL[s.type] ?? s.type}</p>
                  <p className="text-xs text-charcoal/55">
                    {s.base_price_xaf ? `dès ${fcfa(s.base_price_xaf)}` : "—"}
                    {s.zones.length ? ` · ${s.zones.join(", ")}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Documents */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Documents ({documents.length})</h2>
              {missingDocs.length > 0 && <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600">Manquants : {missingDocs.map((d) => DOC_LABEL[d]).join(", ")}</span>}
            </div>
            {documents.length === 0 ? (
              <p className="text-sm text-charcoal/50">{seeded ? "Prestataire de démonstration — pas de documents." : "Aucun document fourni."}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {documents.map((d) => (
                  <DocThumb key={d.id} doc={d} onOpen={(src) => setPreview({ src, label: DOC_LABEL[d.type] ?? d.type })} />
                ))}
              </div>
            )}
          </Card>

          {p.kind === "business" && (
            <Card className="p-5">
              <h2 className="mb-3 font-bold">Flotte de location ({fleet.length})</h2>
              {fleet.length === 0 ? (
                <p className="text-sm text-charcoal/50">Aucun véhicule déclaré.</p>
              ) : (
                <ul className="divide-y divide-grey/70 text-sm">
                  {fleet.map((v) => (
                    <li key={v.id} className="flex items-center justify-between py-2">
                      <span>
                        <span className="font-semibold">
                          {v.brand} {v.model}
                        </span>{" "}
                        <span className="font-mono text-xs text-charcoal/55">{v.plate}</span>
                      </span>
                      <span className="text-charcoal/65">
                        {fcfa(v.price_per_day_xaf)}/j · {v.with_driver ? "avec chauffeur" : "sans chauffeur"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {/* Decision panel */}
        <div className="space-y-6">
          <Card className="p-5 xl:sticky xl:top-6">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <ShieldCheck className="w-5 h-5 text-green" /> Contrôle & décision
            </h2>
            <div className="space-y-2">
              {CHECKLIST[p.kind].map((c, i) => (
                <label key={c} className="flex cursor-pointer items-start gap-3 rounded-xl p-2 text-sm hover:bg-ivory">
                  <input
                    type="checkbox"
                    checked={!!checked[i]}
                    onChange={(e) => setChecked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))}
                    className="mt-0.5 h-4 w-4 accent-[#087C55]"
                  />
                  {c}
                </label>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif / message au demandeur (obligatoire sauf pour approuver)"
              rows={3}
              className="mt-4 w-full rounded-xl border border-grey p-3 text-sm focus:outline-none focus:border-green"
            />
            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <DecisionButton tone="green" icon={Check} label="Approuver" busy={busy === "approve"} disabled={!!busy || p.verification_status === "approved"} onClick={() => act("approve")} />
              <DecisionButton tone="orange" icon={Pencil} label="Demander modifs" busy={busy === "request_changes"} disabled={!!busy} onClick={() => act("request_changes")} />
              <DecisionButton tone="red" icon={X} label="Rejeter" busy={busy === "reject"} disabled={!!busy || p.verification_status === "rejected"} onClick={() => act("reject")} />
              <DecisionButton tone="grey" icon={Ban} label="Suspendre" busy={busy === "suspend"} disabled={!!busy || p.verification_status === "suspended"} onClick={() => act("suspend")} />
            </div>
            <p className="mt-3 text-xs text-charcoal/50">Chaque décision est journalisée et notifiée au demandeur. Une suspension masque immédiatement le prestataire.</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-bold">Historique</h2>
            {audit.length === 0 ? (
              <p className="text-sm text-charcoal/50">Aucune décision.</p>
            ) : (
              <ol className="space-y-3">
                {audit.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={DECISION_STATUS[a.decision] ?? a.decision} />
                      <span className="text-xs text-charcoal/45">{dt(a.at)}</span>
                    </div>
                    {a.reason && <p className="mt-1 text-charcoal/65">{a.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
            {p.verification_status === "approved" && (
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-grey pt-4 text-center text-xs">
                <div>
                  <p className="text-lg font-extrabold">{p.trips_completed}</p>
                  <p className="text-charcoal/50">courses</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold">{p.rating_count ? p.rating_avg.toFixed(1) : "—"}</p>
                  <p className="text-charcoal/50">note</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold">{p.is_online ? "Oui" : "Non"}</p>
                  <p className="text-charcoal/50">en ligne</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreview(null)} role="dialog" aria-label={preview.label}>
          <div className="max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between text-white">
              <p className="font-bold">{preview.label}</p>
              <button onClick={() => setPreview(null)} aria-label="Fermer" className="rounded-full bg-white/10 p-2 hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.src} alt={preview.label} className="max-h-[80vh] w-auto rounded-xl" />
          </div>
        </div>
      )}
    </AdminShell>
  );
}

/** Private documents are fetched through a 5-minute signed URL, only by an admin session. */
function DocThumb({ doc, onOpen }: { doc: Doc; onOpen: (src: string) => void }) {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    documentUrl(doc).then(setSrc);
  }, [doc]);
  const label = DOC_LABEL[doc.type] ?? doc.type;
  return (
    <button
      onClick={async () => {
        const fresh = await documentUrl(doc); // re-sign: links expire after 5 minutes
        if (fresh) onOpen(fresh);
      }}
      disabled={!src}
      className="group overflow-hidden rounded-xl border border-grey text-left hover:border-green/40 disabled:opacity-60"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-28 w-full object-cover transition group-hover:scale-105" />
      ) : (
        <span className="flex h-28 w-full items-center justify-center bg-ivory text-xs text-charcoal/45">{src === null ? "Indisponible" : "…"}</span>
      )}
      <p className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold">
        <FileText className="w-3.5 h-3.5 text-green" /> {label}
      </p>
    </button>
  );
}

function Row({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cx("rounded-xl bg-ivory p-3", wide && "sm:col-span-2")}>
      <dt className="text-xs text-charcoal/50">{label}</dt>
      <dd className={cx("font-semibold break-words", mono && "font-mono")}>{value}</dd>
    </div>
  );
}

function DecisionButton({
  tone,
  icon: Icon,
  label,
  busy,
  disabled,
  onClick,
}: {
  tone: "green" | "orange" | "red" | "grey";
  icon: React.ElementType;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const cls = {
    green: "bg-green text-white hover:bg-green-dark",
    orange: "border border-orange text-[#B25E0B] hover:bg-orange/10",
    red: "border border-red-300 text-red-600 hover:bg-red-50",
    grey: "border border-grey text-charcoal hover:bg-charcoal/5",
  }[tone];
  return (
    <button onClick={onClick} disabled={disabled} className={cx("inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:opacity-40", cls)}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}
