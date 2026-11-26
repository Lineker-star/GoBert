"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Bell,
  Bot,
  CalendarDays,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
  UserRound,
  Users,
  Handshake,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getNotifications, markNotificationsRead } from "@/lib/api";
import type { MockNotification } from "@/lib/mock-store";
import { formatDate } from "@/lib/format";
import { Avatar, PageLoader, cx } from "./primitives";
import { LanguageSwitcher, Logo } from "./brand";
import { InstallAppButton, InstallBanner } from "@/components/pwa/InstallApp";

type NavItem = { href: string; label: string; icon: React.ElementType; match?: string[]; mobile?: boolean };

/** Navigation per account type. `mobile` marks the (max 5) bottom-bar items. */
function useNav(): NavItem[] {
  const t = useTranslations("nav");
  const { session, role, isAnonymous } = useAuth();
  if (role === "rider") {
    return [
      { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, mobile: true },
      { href: "/trips", label: t("trips"), icon: CalendarDays, mobile: true },
      { href: "/directory", label: t("directory"), icon: Users },
      { href: "/assistant", label: t("assistant"), icon: Bot, mobile: true },
      { href: "/profile", label: t("profile"), icon: UserRound, mobile: true },
    ];
  }
  if (role === "business") {
    return [
      { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard, mobile: true },
      { href: "/directory", label: t("directory"), icon: Users, mobile: true },
      { href: "/rent", label: t("rent"), icon: KeyRound },
      { href: "/assistant", label: t("assistant"), icon: Bot, mobile: true },
      { href: "/profile", label: t("profile"), icon: UserRound, mobile: true },
    ];
  }
  const registered = !!session && !isAnonymous;
  return [
    { href: "", label: t("ride"), icon: MapPin, match: ["", "/map", "/booking"], mobile: true },
    { href: "/dashboard", label: t("services"), icon: LayoutGrid, mobile: true },
    { href: "/trips", label: t("trips"), icon: CalendarDays, mobile: !!session },
    { href: "/express", label: t("express"), icon: Package },
    { href: "/rent", label: t("rent"), icon: KeyRound },
    { href: "/directory", label: t("directory"), icon: Users, mobile: !session },
    { href: "/assistant", label: t("assistant"), icon: Bot, mobile: true },
    ...(registered
      ? [{ href: "/profile", label: t("profile"), icon: UserRound, mobile: true }]
      : [
          { href: "/partners", label: t("partners"), icon: Handshake },
          { href: "/auth", label: t("signIn"), icon: UserRound, mobile: true },
        ]),
  ];
}

export function NotificationBell() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const { profile } = useAuth();
  const [items, setItems] = useState<MockNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const userId = profile?.id ?? null;

  const load = useCallback(() => {
    if (!userId) return;
    getNotifications(userId).then(setItems).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!userId) return null;
  const unread = items.filter((n) => !n.read).length;

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && unread > 0) markNotificationsRead(userId).then(load).catch(() => undefined);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white border border-grey text-charcoal hover:border-green/40"
        aria-label={t("title")}
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-grey bg-white shadow-xl z-50 overflow-hidden animate-scale-in">
          <p className="px-4 pt-4 pb-2 text-sm font-bold text-charcoal">{t("title")}</p>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 pb-5 text-sm text-charcoal/50">{t("empty")}</p>
            ) : (
              items.map((n) => (
                <div key={n.id} className="px-4 py-3 border-t border-grey/60">
                  <p className="text-sm text-charcoal">{t(`kind.${n.kind}`, n.params)}</p>
                  <p className="text-xs text-charcoal/45 mt-0.5">{formatDate(n.at, locale, true)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ nav, isActive }: { nav: NavItem[]; isActive: (i: NavItem) => boolean }) {
  const locale = useLocale();
  const t = useTranslations();
  const { session, profile, isAnonymous } = useAuth();
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[248px] flex-col border-r border-grey/80 bg-white px-4 py-5">
      <Logo href={`/${locale}`} className="h-10 ml-1" />
      <nav className="mt-8 flex-1 space-y-1" aria-label="Main">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
                active ? "bg-green text-white shadow-md shadow-green/25" : "text-charcoal/70 hover:bg-ivory hover:text-charcoal",
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3">
        <InstallAppButton />
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-charcoal/45">{t("profile.language")}</span>
          <LanguageSwitcher />
        </div>
        {session && !isAnonymous && profile ? (
          <Link href={`/${locale}/profile`} className="flex items-center gap-3 rounded-2xl border border-grey p-2.5 hover:border-green/40">
            <Avatar name={profile.full_name} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{profile.full_name}</span>
              <span className="block text-xs text-charcoal/50">{t(`roles.${profile.role}.label`)}</span>
            </span>
          </Link>
        ) : (
          <Link href={`/${locale}/auth`} className="flex h-11 items-center justify-center rounded-2xl bg-forest text-sm font-bold !text-white hover:bg-charcoal">
            {t("nav.signIn")}
          </Link>
        )}
      </div>
    </aside>
  );
}

export default function AppShell({
  children,
  title,
  back,
  wide,
  hideBottomNav,
  actions,
  fullBleed,
}: {
  children: React.ReactNode;
  title?: string;
  /** Show a back arrow linking to this (locale-less) path. */
  back?: string;
  wide?: boolean;
  hideBottomNav?: boolean;
  actions?: React.ReactNode;
  /** Edge-to-edge content (maps). */
  fullBleed?: boolean;
}) {
  const locale = useLocale();
  const pathname = usePathname() ?? "";
  const t = useTranslations();
  const { session, profile, isAnonymous, loading, profileLoading, profileMissing } = useAuth();
  const router = useRouter();
  const nav = useNav();
  const rel = pathname.replace(/^\/(fr|en)/, "") || "";

  // Signed in (e.g. after clicking the email confirmation link) but sign-up not finished:
  // send the user to the profile step on every page, not only on protected ones.
  const needsProfile = !loading && !profileLoading && profileMissing;
  useEffect(() => {
    if (needsProfile) router.replace(`/${locale}/auth?step=profile`);
  }, [needsProfile, router, locale]);
  const isActive = (item: NavItem) => (item.match ?? [item.href]).some((m) => (m === "" ? rel === "" : rel === m || rel.startsWith(`${m}/`)));
  const mobileNav = nav.filter((n) => n.mobile).slice(0, 5);

  return (
    <div className="min-h-dvh bg-ivory">
      <Sidebar nav={nav} isActive={isActive} />

      <div className="lg:pl-[248px]">
        {/* Top bar: full on mobile, slim title bar on desktop */}
        <header className={cx("sticky top-0 z-30 border-b border-grey/70 bg-ivory/90 backdrop-blur-md", fullBleed && "lg:hidden")}>
          <div className={cx("mx-auto flex h-16 items-center gap-3 px-4", !fullBleed && (wide ? "lg:max-w-6xl" : "lg:max-w-5xl"))}>
            {back !== undefined ? (
              <Link
                href={`/${locale}${back}`}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-grey text-charcoal hover:border-green/40"
                aria-label={t("common.back")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            ) : (
              <Logo href={`/${locale}`} className="h-9 lg:hidden" />
            )}
            {title && <h1 className="text-lg font-bold text-charcoal truncate">{title}</h1>}
            <div className="ml-auto flex items-center gap-2">
              {actions}
              <LanguageSwitcher className="lg:hidden" />
              {session && !isAnonymous && <NotificationBell />}
              {session && !isAnonymous ? (
                <Link href={`/${locale}/profile`} aria-label={t("nav.profile")} className="rounded-full ring-2 ring-white hover:ring-green/30 lg:hidden">
                  <Avatar name={profile?.full_name ?? null} size={40} />
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {fullBleed ? (
          <main className="relative h-[calc(100dvh-4rem)] lg:h-dvh">{children}</main>
        ) : (
          <main className={cx("mx-auto px-4 pt-5", wide ? "max-w-6xl" : "max-w-5xl", hideBottomNav ? "pb-10" : "pb-28 lg:pb-12")}>{children}</main>
        )}
      </div>

      {!hideBottomNav && (
        <>
          {/* Install prompt only on the dashboard, where it never hides the booking sheet */}
          {!fullBleed && rel === "/dashboard" && <InstallBanner />}
          <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-grey bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" aria-label="Bottom">
            <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
              {mobileNav.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={`/${locale}${item.href}`} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold" aria-current={active ? "page" : undefined}>
                    <span className={cx("flex h-9 w-12 items-center justify-center rounded-full transition", active ? "bg-green text-white shadow-md shadow-green/25" : "text-charcoal/50")}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className={active ? "text-green" : "text-charcoal/55"}>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

/**
 * Client-side gate (the database enforces the real rules). Redirects to sign-in when
 * there is no session, to profile completion when a signed-in user has no profile yet,
 * and to the dashboard when the role is not allowed.
 */
export function RequireAuth({
  children,
  allowGuest = false,
  allowVisitor = false,
  roles,
}: {
  children: React.ReactNode;
  /** Anonymous guest sessions may enter. */
  allowGuest?: boolean;
  /** Visitors without any session may enter too. */
  allowVisitor?: boolean;
  roles?: ("customer" | "rider" | "business")[];
}) {
  const { session, loading, profile, profileLoading, profileMissing, isAnonymous } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");

  const needsLogin = !loading && !session && !allowVisitor;
  const guestBlocked = !loading && isAnonymous && !allowGuest;
  const needsProfile = !loading && !profileLoading && profileMissing;
  // Administrators use the public app like customers; their powers live in the admin console.
  const effectiveRole = profile?.role === "admin" ? "customer" : profile?.role;
  const wrongRole = !loading && !!effectiveRole && !!roles && !roles.includes(effectiveRole);
  const guestRoleBlocked = !loading && (isAnonymous || !session) && !!roles && !roles.includes("customer");

  useEffect(() => {
    if (needsLogin || guestBlocked || guestRoleBlocked) router.replace(`/${locale}/auth?next=${encodeURIComponent(pathname ?? "")}`);
    else if (needsProfile) router.replace(`/${locale}/auth?step=profile`);
    else if (wrongRole) router.replace(`/${locale}/dashboard`);
  }, [needsLogin, guestBlocked, guestRoleBlocked, needsProfile, wrongRole, router, locale, pathname]);

  if (loading || profileLoading || needsLogin || guestBlocked || guestRoleBlocked || needsProfile || wrongRole) {
    return <PageLoader label={t("loading")} />;
  }
  return <>{children}</>;
}
