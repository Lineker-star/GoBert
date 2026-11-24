"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, LogOut } from "lucide-react";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("gobert:admin");
    if (!token) {
      router.replace("/login");
      setAuthed(false);
    } else {
      setAuthed(true);
    }
  }, [router]);

  if (authed === null) {
    return <div className="min-h-screen flex items-center justify-center text-charcoal/40">…</div>;
  }
  if (!authed) return null;

  const nav = [
    { href: "/overview", label: "Vue d'ensemble", Icon: LayoutDashboard },
    { href: "/providers", label: "Prestataires", Icon: Users },
  ];

  const signOut = () => {
    localStorage.removeItem("gobert:admin");
    router.replace("/login");
  };

  return (
    <div className="min-h-screen flex bg-ivory">
      <aside className="w-56 bg-forest text-white p-4 flex flex-col">
        <div className="text-lg font-bold mb-8">GoBert Admin</div>
        <nav className="space-y-1 flex-1">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname === href || (href === "/providers" && pathname.startsWith("/providers"));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                  active ? "bg-white/15" : "hover:bg-white/10"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/10">
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}