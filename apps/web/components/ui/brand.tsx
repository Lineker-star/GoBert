"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Bike, Car, Package, Truck, KeyRound, Warehouse, Bus } from "lucide-react";
import { cx } from "./primitives";

export function Logo({ variant = "full", className, href, priority }: { variant?: "full" | "mark" | "white"; className?: string; href?: string; priority?: boolean }) {
  const img =
    variant === "mark" ? (
      <Image src="/brand/logo-mark.png" alt="GoBert" width={40} height={40} className={cx("h-10 w-10", className)} priority={priority} />
    ) : (
      <Image
        src={variant === "white" ? "/brand/logo-full-white.png" : "/brand/logo-full.png"}
        alt="GoBert — Move. Connect. Go."
        width={640}
        height={202}
        className={cx("h-10 w-auto", className)}
        priority={priority}
      />
    );
  return href ? (
    <Link href={href} aria-label="GoBert" className="inline-flex items-center">
      {img}
    </Link>
  ) : (
    img
  );
}

export const SERVICE_ICON: Record<string, React.ElementType> = {
  moto: Bike,
  ride: Car,
  express: Package,
  cargo: Truck,
  rent: KeyRound,
  logistics: Warehouse,
};

export const VEHICLE_ICON: Record<string, React.ElementType> = {
  moto: Bike,
  taxi: Car,
  car: Car,
  tricycle: Package,
  truck: Truck,
  van: Bus,
  car_rental: KeyRound,
};

export function ServiceIcon({ service, className }: { service: string; className?: string }) {
  const Icon = SERVICE_ICON[service] ?? VEHICLE_ICON[service] ?? Car;
  return <Icon className={cx("w-5 h-5", className)} aria-hidden />;
}

/** Switches /fr/... <-> /en/... keeping the rest of the path and the query string. */
export function LanguageSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const locale = useLocale();
  const pathname = usePathname() ?? `/${locale}`;
  const router = useRouter();
  const go = (next: "fr" | "en") => {
    if (next === locale) return;
    const rest = pathname.replace(/^\/(fr|en)(?=\/|$)/, "");
    router.replace(`/${next}${rest || ""}${window.location.search}`);
  };
  return (
    <div
      className={cx(
        "inline-flex rounded-full p-0.5 text-xs font-bold",
        tone === "dark" ? "bg-white/10" : "bg-charcoal/5",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => go(l)}
          aria-pressed={locale === l}
          className={cx(
            "rounded-full px-2.5 py-1 uppercase transition",
            locale === l
              ? tone === "dark"
                ? "bg-white text-forest"
                : "bg-white text-green shadow-sm"
              : tone === "dark"
                ? "text-white/70 hover:text-white"
                : "text-charcoal/55 hover:text-charcoal",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
