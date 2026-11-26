import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/**
 * Admin sessions live in sessionStorage (cleared when the tab closes), under their
 * own key, and never in the same storage as the public app.
 */
export const supabase = createClient(url || "http://localhost", key || "public-anon-key", {
  auth: {
    storageKey: "gobert-admin-auth",
    storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** True only when signed in, past 2FA (aal2) and the database confirms the admin role. */
export async function checkAdminSession(): Promise<"ok" | "login" | "mfa" | "denied"> {
  if (USE_MOCKS) return typeof window !== "undefined" && sessionStorage.getItem("gobert:admin-mock") ? "ok" : "login";
  const { data } = await supabase.auth.getSession();
  if (!data.session) return "login";
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") return "mfa";
  const { data: isAdmin, error } = await supabase.rpc("am_i_admin");
  if (error || !isAdmin) return "denied";
  return "ok";
}

export async function adminSignOut() {
  if (USE_MOCKS) sessionStorage.removeItem("gobert:admin-mock");
  else await supabase.auth.signOut();
}
