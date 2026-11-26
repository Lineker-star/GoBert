"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button, Modal, cx } from "@/components/ui/primitives";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// The browser fires beforeinstallprompt once, early — keep it in a module-level store.
let deferred: BIPEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useInstallApp() {
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferred, () => false);
  const done = useSyncExternalStore(subscribe, () => installed, () => false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setStandalone(isStandalone());
    setIos(isIOS());
  }, []);
  const available = !standalone && !done;

  const install = async (): Promise<"prompted" | "manual"> => {
    if (deferred) {
      const e = deferred;
      deferred = null;
      emit();
      await e.prompt();
      await e.userChoice.catch(() => undefined);
      return "prompted";
    }
    return "manual";
  };

  return { available, canPrompt, ios, install };
}

/** "Install the app" button; falls back to step-by-step instructions (iPhone, or browsers without a prompt). */
export function InstallAppButton({ variant = "sidebar", className }: { variant?: "sidebar" | "card" | "compact"; className?: string }) {
  const t = useTranslations("install");
  const { available, ios, install } = useInstallApp();
  const [help, setHelp] = useState(false);
  if (!available) return null;

  const onClick = async () => {
    const r = await install();
    if (r === "manual") setHelp(true);
  };

  return (
    <>
      {variant === "card" ? (
        <div className={cx("flex items-center gap-3 rounded-2xl bg-forest p-4 text-white", className)}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Download className="w-5 h-5 text-orange" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">{t("title")}</p>
            <p className="text-xs text-white/70">{t("subtitle")}</p>
          </div>
          <Button size="sm" variant="accent" onClick={onClick}>
            {t("cta")}
          </Button>
        </div>
      ) : variant === "compact" ? (
        <button onClick={onClick} className={cx("inline-flex h-10 items-center gap-2 rounded-full bg-orange px-4 text-sm font-bold text-white shadow-md shadow-orange/25", className)}>
          <Download className="w-4 h-4" /> {t("cta")}
        </button>
      ) : (
        <button
          onClick={onClick}
          className={cx("flex w-full items-center gap-3 rounded-2xl bg-orange/15 px-3 py-2.5 text-sm font-bold text-[#B25E0B] transition hover:bg-orange/25", className)}
        >
          <Download className="w-4 h-4" />
          <span className="flex-1 text-left">{t("cta")}</span>
        </button>
      )}
      <Modal open={help} onClose={() => setHelp(false)} title={t("title")} closeLabel={t("close")}>
        <ol className="space-y-4 text-sm">
          {ios ? (
            <>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green/10 text-green">
                  <Share className="w-4 h-4" />
                </span>
                <span>{t("ios1")}</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green/10 text-green">
                  <SquarePlus className="w-4 h-4" />
                </span>
                <span>{t("ios2")}</span>
              </li>
            </>
          ) : (
            <>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green/10 font-bold text-green">1</span>
                <span>{t("other1")}</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green/10 font-bold text-green">2</span>
                <span>{t("other2")}</span>
              </li>
            </>
          )}
        </ol>
        <p className="mt-5 text-xs text-charcoal/55">{t("why")}</p>
      </Modal>
    </>
  );
}

/** One-time dismissible banner on phones. */
export function InstallBanner() {
  const t = useTranslations("install");
  const { available } = useInstallApp();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("gobert:install-dismissed") === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (!available || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem("gobert:install-dismissed", "1");
    } catch {
      // ignore
    }
  };
  return (
    <div className="lg:hidden fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 animate-slide-in-bottom">
      <div className="relative">
        <InstallAppButton variant="card" className="shadow-2xl" />
        <button onClick={dismiss} aria-label={t("close")} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white text-charcoal shadow">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
