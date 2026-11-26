"use client";
import { useLocale, useTranslations } from "next-intl";
import { Ban, BadgeCheck, CircleCheck, FileText, Hourglass, Pencil, ShieldCheck, TriangleAlert } from "lucide-react";
import type { MockProvider } from "@/lib/mock-store";
import { formatDate } from "@/lib/format";
import { Badge, Button, Card, STATUS_TONE, cx } from "@/components/ui/primitives";

const ICON: Record<string, React.ElementType> = {
  pending: Hourglass,
  approved: BadgeCheck,
  changes_requested: Pencil,
  rejected: TriangleAlert,
  suspended: Ban,
};

/** Explains where a rider / business is in the admin verification process. */
export function VerificationPanel({ provider, onEdit, compact }: { provider: MockProvider; onEdit?: () => void; compact?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const status = provider.verification_status;
  const Icon = ICON[status] ?? Hourglass;
  const approved = status === "approved";
  const stage = approved ? 3 : status === "pending" ? 2 : 1;

  const steps = [
    { key: "submitted", icon: FileText, done: true },
    { key: "review", icon: ShieldCheck, done: stage >= 2 && status !== "changes_requested" && status !== "rejected" },
    { key: "live", icon: CircleCheck, done: approved },
  ];

  return (
    <Card className={cx("overflow-hidden", approved ? "border-green/30" : status === "pending" ? "border-orange/30" : "border-red-200")}>
      <div
        className={cx(
          "flex items-start gap-4 p-5",
          approved ? "bg-green/5" : status === "pending" ? "bg-orange/10" : "bg-red-50/70",
        )}
      >
        <span
          className={cx(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white",
            approved ? "bg-green" : status === "pending" ? "bg-orange" : "bg-red-500",
          )}
        >
          <Icon className="w-6 h-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-extrabold">{t(`verification.${status}.title`)}</p>
            <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
          </div>
          <p className="mt-1 text-sm text-charcoal/65">{t(`verification.${status}.desc`)}</p>
          {provider.review_note && !approved && (
            <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm">
              <span className="font-bold">{t("verification.adminNote")}: </span>
              {provider.review_note}
            </p>
          )}
          {onEdit && (
            <div className="mt-4">
              <Button variant="accent" size="sm" onClick={onEdit}>
                <Pencil className="w-4 h-4" /> {t("verification.update")}
              </Button>
            </div>
          )}
        </div>
      </div>
      {!compact && (
        <div className="px-5 py-4">
          <ol className="flex items-center gap-2">
            {steps.map((s, i) => {
              const SIcon = s.icon;
              return (
                <li key={s.key} className="flex flex-1 items-center gap-2">
                  <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", s.done ? "bg-green text-white" : "bg-charcoal/5 text-charcoal/40")}>
                    <SIcon className="w-4 h-4" />
                  </span>
                  <span className={cx("text-xs font-semibold", s.done ? "text-charcoal" : "text-charcoal/45")}>{t(`verification.timeline.${s.key}`)}</span>
                  {i < steps.length - 1 && <span className={cx("h-0.5 flex-1 rounded", s.done ? "bg-green" : "bg-grey")} aria-hidden />}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-charcoal/45">
            {t("verification.submittedOn", { date: formatDate(provider.submitted_at, locale) })}
            {provider.reviewed_at ? ` · ${t("verification.reviewedOn", { date: formatDate(provider.reviewed_at, locale) })}` : ""}
          </p>
        </div>
      )}
    </Card>
  );
}
