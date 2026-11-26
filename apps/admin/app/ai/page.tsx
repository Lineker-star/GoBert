"use client";
import { useEffect, useState, useCallback } from "react";
import AdminShell from "@/components/AdminShell";
import { getAISettings, updateAISettings, type AISettings } from "@/lib/admin-api";

export default function AISettingsPage() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAISettings().then(setSettings);
  }, []);

  const patch = useCallback((p: Partial<AISettings>) => {
    setSettings((s) => (s ? { ...s, ...p } : s));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const updated = await updateAISettings({
      enabled: settings.enabled,
      model: settings.model,
      system_prompt: settings.system_prompt,
      rate_limit: settings.rate_limit,
      id: settings.id,
    });
    if (updated) setSettings(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return <AdminShell><div className="text-charcoal/40">Chargement…</div></AdminShell>;

  return (
    <AdminShell>
      <h1 className="text-2xl font-extrabold text-charcoal mb-6">Assistant IA</h1>

      <div className="bg-white rounded-2xl border border-grey p-5 space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-charcoal">Assistant IA</div>
            <div className="text-xs text-charcoal/50">Activer ou désactiver l&apos;assistant pour les passagers</div>
          </div>
          <button
            onClick={() => patch({ enabled: !settings.enabled })}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${settings.enabled ? "bg-green text-white" : "bg-grey text-charcoal"}`}
          >
            {settings.enabled ? "Activé" : "Désactivé"}
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Modèle</label>
          <input
            value={settings.model}
            onChange={(e) => patch({ model: e.target.value })}
            className="w-full border border-grey rounded-xl px-3 py-2 text-sm mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Prompt système</label>
          <textarea
            value={settings.system_prompt}
            onChange={(e) => patch({ system_prompt: e.target.value })}
            rows={3}
            className="w-full border border-grey rounded-xl px-3 py-2 text-sm mt-1"
          />
        </div>

        {settings.rate_limit !== undefined && (
        <div>
          <label className="text-xs font-semibold text-charcoal/60 uppercase tracking-wider">Limite (requêtes/heure)</label>
          <input
            type="number"
            value={settings.rate_limit}
            onChange={(e) => patch({ rate_limit: Number(e.target.value) })}
            className="w-full border border-grey rounded-xl px-3 py-2 text-sm mt-1"
          />
        </div>
        )}

        <button onClick={save} disabled={saving} className="bg-green text-white rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
          {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}
        </button>
      </div>

      {settings.usage && (
      <div className="bg-white rounded-2xl border border-grey p-5 mt-4 max-w-2xl">
        <h2 className="text-sm font-semibold text-charcoal/70 uppercase tracking-wider mb-3">Utilisation</h2>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Requêtes" value={settings.usage.requests} />
          <Stat label="Tokens entrée" value={settings.usage.input_tokens} />
          <Stat label="Tokens sortie" value={settings.usage.output_tokens} />
        </div>
      </div>
      )}
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-charcoal/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-charcoal mt-1">{value}</div>
    </div>
  );
}