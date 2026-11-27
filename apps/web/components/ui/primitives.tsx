"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { Loader2, X } from "lucide-react";
import { initials } from "@/lib/format";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ Button

type Variant = "primary" | "accent" | "dark" | "outline" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-green text-white hover:bg-green-dark shadow-sm shadow-green/20",
  accent: "bg-orange text-white hover:bg-orange-dark shadow-sm shadow-orange/25",
  dark: "bg-forest text-white hover:bg-charcoal",
  outline: "border border-grey bg-white text-charcoal hover:border-green/50 hover:bg-green/5",
  ghost: "text-charcoal hover:bg-charcoal/5",
  danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  soft: "bg-green/10 text-green hover:bg-green/15",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl gap-1.5",
  md: "h-11 px-4 text-sm rounded-xl gap-2",
  lg: "h-13 px-6 text-base rounded-2xl gap-2",
};

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  loading,
  block,
  href,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const cls = cx(
    "inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
    className,
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={cls} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Card

export function Card({
  className,
  children,
  as: Tag = "div",
  ...rest
}: { as?: "div" | "section" | "article" } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Tag className={cx("bg-white rounded-3xl border border-grey/80 shadow-[0_1px_2px_rgba(18,61,50,0.04)]", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-center justify-between gap-3 mb-3", className)}>
      <h2 className="text-base font-bold text-charcoal">{children}</h2>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ Badges

type Tone = "green" | "orange" | "red" | "grey" | "blue" | "forest";
const TONE: Record<Tone, string> = {
  green: "bg-green/10 text-green",
  orange: "bg-orange/15 text-[#B25E0B]",
  red: "bg-red-50 text-red-600",
  grey: "bg-charcoal/5 text-charcoal/70",
  blue: "bg-blue-50 text-blue-700",
  forest: "bg-forest text-white",
};

export function Badge({ tone = "grey", children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONE[tone], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  approved: "green",
  completed: "green",
  confirmed: "green",
  delivered: "green",
  active: "blue",
  in_progress: "blue",
  in_transit: "blue",
  arriving: "blue",
  accepted: "blue",
  pending: "orange",
  requested: "orange",
  changes_requested: "orange",
  rejected: "red",
  declined: "red",
  suspended: "red",
  cancelled: "grey",
  expired: "grey",
};

// ------------------------------------------------------------------ Form

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
  optionalLabel,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
  optionalLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-charcoal">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-charcoal/45">{optionalLabel ?? "optional"}</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-charcoal/50">{hint}</p>
      ) : null}
    </div>
  );
}

/** A page-supplied width (w-…, flex-…) replaces the default full width instead of fighting it. */
const width = (className?: string) => (className && /(^|\s)(w-|flex-1|basis-)/.test(className) ? "" : "w-full");

const inputBase =
  "rounded-xl border border-grey bg-white px-3.5 text-[15px] text-charcoal placeholder:text-charcoal/35 transition focus:outline-none focus:border-green focus:ring-4 focus:ring-green/10 disabled:bg-grey/40";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(inputBase, width(className), "h-12", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cx(inputBase, width(className), "h-12 pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(inputBase, width(className), "py-3 min-h-[88px]", className)} {...rest} />;
});

/** Pill-style single choice. Selected = solid green with white text. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cx("flex flex-wrap gap-2", className)} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-xl border font-semibold transition",
              size === "sm" ? "h-9 px-3 text-xs" : "h-11 px-4 text-sm",
              active ? "bg-green border-green text-white shadow-sm shadow-green/20" : "bg-white border-grey text-charcoal hover:border-green/50",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cx("flex items-start gap-3 cursor-pointer select-none", disabled && "opacity-50 cursor-not-allowed")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-green" : "bg-charcoal/20",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
      <span>
        <span className="block text-sm font-semibold text-charcoal">{label}</span>
        {description && <span className="block text-xs text-charcoal/55 mt-0.5">{description}</span>}
      </span>
    </label>
  );
}

// ------------------------------------------------------------------ Misc

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("w-5 h-5 animate-spin text-green", className)} aria-hidden />;
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-charcoal/50" role="status">
      <Spinner className="w-7 h-7" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function Avatar({ name, src, size = 44, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cx("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-green to-forest font-bold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-10">
      {icon && <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green/10 text-green">{icon}</div>}
      <p className="font-semibold text-charcoal">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-charcoal/55">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, icon, tone = "green" }: { label: string; value: React.ReactNode; icon?: React.ReactNode; tone?: "green" | "orange" | "forest" }) {
  const iconTone = tone === "orange" ? "bg-orange/15 text-[#B25E0B]" : tone === "forest" ? "bg-forest text-white" : "bg-green/10 text-green";
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        {icon && <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", iconTone)}>{icon}</span>}
        <div className="min-w-0">
          <p className="text-xs font-medium leading-tight text-charcoal/55 line-clamp-2">{label}</p>
          <p className="text-lg font-bold text-charcoal truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export function Alert({ tone = "orange", title, children, icon, action }: { tone?: Tone; title?: string; children?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  const border: Record<Tone, string> = {
    green: "border-green/25 bg-green/5",
    orange: "border-orange/30 bg-orange/10",
    red: "border-red-200 bg-red-50",
    grey: "border-grey bg-white",
    blue: "border-blue-200 bg-blue-50",
    forest: "border-forest bg-forest text-white",
  };
  return (
    <div className={cx("rounded-2xl border p-4 flex gap-3", border[tone])} role={tone === "red" ? "alert" : "status"}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "opacity-85")}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  closeLabel = "Close",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-forest/40 backdrop-blur-[2px] p-0 sm:p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-in-bottom">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-white px-5 pt-5 pb-3">
          <h2 className="text-lg font-bold text-charcoal">{title}</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-charcoal/5 text-charcoal/70 hover:bg-charcoal/10" aria-label={closeLabel}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-6">{children}</div>
      </div>
    </div>
  );
}

/** Pickup → destination visual with dots and a connecting line. */
export function RouteLine({ from, to, fromLabel, toLabel }: { from: string; to: string; fromLabel: string; toLabel: string }) {
  return (
    <div className="relative pl-6 space-y-3">
      <span className="absolute left-[7px] top-2 bottom-2 w-px border-l-2 border-dashed border-grey" aria-hidden />
      <div className="relative">
        <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-[3px] border-green bg-white" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/45">{fromLabel}</p>
        <p className="text-sm font-semibold text-charcoal">{from}</p>
      </div>
      <div className="relative">
        <span className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full bg-orange ring-4 ring-orange/15" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal/45">{toLabel}</p>
        <p className="text-sm font-semibold text-charcoal">{to}</p>
      </div>
    </div>
  );
}
