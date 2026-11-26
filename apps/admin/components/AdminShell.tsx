"use client";
import { asset } from "@/lib/asset";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Activity, Bot, LayoutDashboard, LogOut, Menu, ShieldCheck, Users, X, UserPlus, Banknote, ScrollText } from "lucide-react";
import { checkAdminSession, adminSignOut } from "@/lib/supabase";
import { getQueue } from "@/lib/admin-api";
import { cx } from "./ui";

const NAV = [
  { href: "/overview", label: "Vue d'ensemble", Icon: LayoutDashboard },
  { href: "/providers", label: "Vérifications", Icon: ShieldCheck, badge: true },
  { href: "/providers/new", label: "Créer un prestataire", Icon: UserPlus },
  { href: "/users", label: "Utilisateurs", Icon: Users },
  { href: "/activity", label: "Activité", Icon: Activity },
  { href: "/pricing", label: "Tarifs", Icon: Banknote },
  { href: "/audit", label: "Journal d'audit", Icon: ScrollText },
  { href: "/ai", label: "Assistant IA", Icon: Bot },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pending, setPending] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  // Every page re-checks: signed in, 2FA (aal2) passed, and admin role confirmed by the database.
  useEffect(() => {
    checkAdminSession().then((s) => {
      setAuthed(s === "ok");
      if (s !== "ok") router.replace("/login");
    });
  }, [router]);

  // Idle timeout: sign out after 15 minutes without activity.
  useEffect(() => {
    if (!authed) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await adminSignOut();
        router.replace("/login");
      }, 15 * 60_000);
    };
    const events = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [authed, router]);

  useEffect(() => {
    if (!authed) return;
    const load = () => getQueue("pending").then((l) => setPending(l.length));
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [authed]);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (!authed) {
    return <div className="min-h-screen flex items-center justify-center text-charcoal/40">…</div>;
  }

  const signOut = async () => {
    await adminSignOut();
    router.replace("/login");
  };

  const nav = (
    <nav className="space-y-1" aria-label="Admin">
      {NAV.map(({ href, label, Icon, badge }) => {
        const active = pathname === href || (pathname.startsWith(`${href}/`) && !(href === "/providers" && pathname === "/providers/new"));
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              active ? "bg-white text-forest shadow-sm" : "text-white/75 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="flex-1">{label}</span>
            {badge && pending > 0 && <span className="rounded-full bg-orange px-2 py-0.5 text-[11px] font-bold text-white">{pending}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-ivory lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-forest p-5 sticky top-0 h-screen">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
            <Image src={asset("/logo-mark.png")} alt="" width={30} height={30} />
          </span>
          <div>
            <p className="font-extrabold text-white leading-tight">GoBert</p>
            <p className="text-xs text-white/55">Console d&apos;administration</p>
          </div>
        </div>
        <div className="flex-1">{nav}</div>
        <button onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white">
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center gap-3 bg-forest px-4 text-white">
        <button onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" className="p-1">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <p className="font-extrabold">GoBert Admin</p>
        {pending > 0 && <span className="ml-auto rounded-full bg-orange px-2 py-0.5 text-xs font-bold">{pending} en attente</span>}
      </header>
      {menuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-14 z-40 bg-forest p-4 shadow-xl">
          {nav}
          <button onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70">
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      )}

      <main className="flex-1 min-w-0 p-4 sm:p-8">{children}</main>
    </div>
  );
}
