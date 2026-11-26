"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { Card, Initials, PageTitle, Pill, ROLE_LABEL, StatusBadge, dt } from "@/components/ui";
import { blockUser, getUsers, type User } from "@/lib/admin-api";

const ROLES = [
  { key: "", label: "Tous" },
  { key: "customer", label: "Clients" },
  { key: "rider", label: "Riders" },
  { key: "business", label: "Prestataires" },
];

export default function UsersPage() {
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[] | null>(null);

  useEffect(() => {
    setUsers(null);
    getUsers(role || undefined).then(setUsers);
  }, [role]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? []).filter((u) => !q || u.full_name.toLowerCase().includes(q) || u.phone.includes(q) || (u.email ?? "").toLowerCase().includes(q));
  }, [users, query]);

  return (
    <AdminShell>
      <PageTitle title="Utilisateurs" subtitle="Comptes inscrits, avec leur type choisi à l'inscription." />
      <div className="flex flex-wrap items-center gap-2">
        {ROLES.map((r) => (
          <Pill key={r.key} active={role === r.key} onClick={() => setRole(r.key)}>
            {r.label}
          </Pill>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom, téléphone, e-mail…"
            className="w-full h-10 rounded-xl border border-grey bg-white pl-9 pr-3 text-sm focus:outline-none focus:border-green"
          />
        </div>
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ivory text-left text-xs uppercase tracking-wider text-charcoal/50">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 hidden md:table-cell">Ville</th>
                <th className="px-4 py-3 hidden md:table-cell">Inscrit le</th>
                <th className="px-4 py-3">Vérification</th>
                <th className="px-4 py-3">Accès</th>
              </tr>
            </thead>
            <tbody>
              {users === null && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-charcoal/40">
                    Chargement…
                  </td>
                </tr>
              )}
              {list.map((u) => (
                <tr key={u.id} className="border-t border-grey/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Initials name={u.full_name} dark={u.role === "business"} />
                      <div>
                        <p className="font-semibold">{u.full_name} {u.is_blocked && <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">BLOQUÉ</span>}</p>
                        <p className="text-xs text-charcoal/50">
                          {u.phone}
                          {u.email ? ` · ${u.email}` : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-charcoal/65">{u.city}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-charcoal/55">{dt(u.created_at, false)}</td>
                  <td className="px-4 py-3">
                    {u.role === "customer" ? (
                      <span className="text-xs text-charcoal/45">Non requise</span>
                    ) : u.provider_id ? (
                      <Link href={`/providers/${u.provider_id}`} className="inline-flex items-center gap-2 hover:underline">
                        <StatusBadge status={u.verification_status} />
                      </Link>
                    ) : (
                      <span className="text-xs font-semibold text-[#B25E0B]">Dossier non envoyé</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <BlockButton user={u} onDone={() => getUsers(role || undefined).then(setUsers)} />
                  </td>
                </tr>
              ))}
              {users !== null && list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-charcoal/45">
                    Aucun utilisateur. Les comptes créés depuis l&apos;app web apparaîtront ici.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}

function BlockButton({ user, onDone }: { user: User; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const blocked = !!user.is_blocked;
  const run = async () => {
    setBusy(true);
    const r = await blockUser(user.id, !blocked, reason || (blocked ? "Débloqué" : "Bloqué par un administrateur"));
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? "Erreur");
    setConfirming(false);
    onDone();
  };
  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className={`rounded-lg px-3 h-8 text-xs font-bold ${blocked ? "bg-green/10 text-green" : "border border-red-200 text-red-600 hover:bg-red-50"}`}
      >
        {blocked ? "Débloquer" : "Bloquer"}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      {!blocked && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif" className="h-8 w-28 rounded-lg border border-grey px-2 text-xs" />}
      <button onClick={run} disabled={busy} className="h-8 rounded-lg bg-charcoal px-2 text-xs font-bold text-white">{busy ? "…" : "Confirmer"}</button>
      <button onClick={() => setConfirming(false)} className="h-8 px-1 text-xs text-charcoal/55">Annuler</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
