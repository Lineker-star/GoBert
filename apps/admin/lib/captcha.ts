"use client";
// Cloudflare Turnstile tokens for Supabase Auth (bot protection on sign-up, sign-in,
// SMS/email codes, password reset and guest sessions).
//
// One call = one fresh single-use token. The widget is rendered off to the side and only
// becomes visible when Cloudflare wants the visitor to click ("interaction-only").
// Disabled in demo mode and when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set.

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
export const captchaEnabled = !!SITE_KEY && process.env.NEXT_PUBLIC_USE_MOCKS !== "true";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("captcha unavailable")));
    s.onerror = () => {
      loading = null;
      reject(new Error("captcha unavailable"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Resolves with a fresh token, or undefined when CAPTCHA is not configured. Rejects on failure. */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!captchaEnabled || typeof window === "undefined") return undefined;
  const ts = await loadTurnstile();
  return new Promise<string>((resolve, reject) => {
    const host = document.createElement("div");
    host.setAttribute("data-captcha", "turnstile");
    Object.assign(host.style, { position: "fixed", left: "50%", bottom: "24px", transform: "translateX(-50%)", zIndex: "2147483000" });
    document.body.appendChild(host);
    let id = "";
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (id) ts.remove(id);
      } catch {
        // widget already gone
      }
      host.remove();
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error("captcha timeout"))), 120_000);
    id = ts.render(host, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      language: document.documentElement.lang || "auto",
      callback: (token: string) => finish(() => resolve(token)),
      "error-callback": () => finish(() => reject(new Error("captcha failed"))),
      "expired-callback": () => finish(() => reject(new Error("captcha expired"))),
    });
  });
}
