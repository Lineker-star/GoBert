"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/lib/admin-api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await adminLogin(email, password);
    setBusy(false);
    if (ok) {
      localStorage.setItem("gobert:admin", "true");
      router.replace("/overview");
    } else {
      setError("Identifiants invalides.");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 space-y-4">
        <h1 className="text-xl font-bold text-green">GoBert Admin</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border border-grey rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          className="w-full border border-grey rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green"
        />
        {error && <p className="text-xs text-orange">{error}</p>}
        <button type="submit" disabled={busy} className="w-full bg-green text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}