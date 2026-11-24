"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getProviderDetail, decide, type ProviderDetail } from "@/lib/admin-api";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
  changes_requested: "Modifs. demandées",
  suspended: "Suspendu",
};

const CHECKLIST = ["Identité vérifiée", "Véhicule conforme", "Documents valides", "Services renseignés", "Horaires définis"];

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false, false]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getProviderDetail(id).then(setDetail);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (decision: "approve" | "reject" | "request_changes" | "suspend") => {
    setBusy(true);
    await decide(id, decision, decision === "reject" ? reason : null);
    setBusy(false);
    load();
  };

  if (!detail) {
    return (
      <AdminShell>
        <div className="text-charcoal/40">Chargement…</div>
      </AdminShell>
    );
  }

  const { provider, documents } = detail;

  return (
    <AdminShell>
      <button onClick={() => router.push("/providers")} className="text-green text-sm mb-4">
        ← Retour
      </button>
      <h1 className="text-xl font-bold text-green mb-1">{provider.display_name}</h1>
      <p className="text-sm text-charcoal/50 mb-6">
        {provider.vehicle.brand} {provider.vehicle.model} · {provider.vehicle.plate} ·{" "}
        <span className="font-medium text-charcoal">{STATUS_LABEL[provider.verification_status] ?? provider.verification_status}</span>
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider mb-3">Documents</h2>
          <div className="grid grid-cols-2 gap-3">
            {documents.map((d) => (
              <div key={d.id} className="border border-grey rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.data_url} alt={d.name} className="w-full h-32 object-cover" />
                <div className="px-2 py-1 text-xs text-charcoal/60 truncate">{d.name}</div>
              </div>
            ))}
            {documents.length === 0 && <p className="text-xs text-charcoal/40">Aucun document.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider mb-3">Checklist</h2>
          <div className="space-y-2">
            {CHECKLIST.map((c, i) => (
              <label key={c} className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) => setChecked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))}
                />
                {c}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 mt-4">
        <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider mb-3">Décision</h2>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motif (obligatoire pour un rejet)"
          className="w-full border border-grey rounded-xl p-3 text-sm focus:outline-none focus:border-green mb-3"
          rows={2}
        />
        <div className="flex gap-2">
          <button onClick={() => act("approve")} disabled={busy} className="flex-1 bg-green text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
            Approuver
          </button>
          <button onClick={() => act("request_changes")} disabled={busy} className="flex-1 border border-orange rounded-xl py-2.5 text-sm font-medium text-orange disabled:opacity-50">
            Demander des modifs.
          </button>
          <button onClick={() => act("reject")} disabled={busy} className="flex-1 border border-red-300 rounded-xl py-2.5 text-sm font-medium text-red-600 disabled:opacity-50">
            Rejeter
          </button>
          <button onClick={() => act("suspend")} disabled={busy} className="flex-1 border border-grey rounded-xl py-2.5 text-sm font-medium text-charcoal disabled:opacity-50">
            Suspendre
          </button>
        </div>
      </div>
    </AdminShell>
  );
}