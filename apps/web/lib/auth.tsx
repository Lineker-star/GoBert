"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { ApiError, getUser, registerUser, updateUser } from "./api";
import * as sb from "./sb-api";
import type { MockUser, UserRole } from "./mock-store";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";
const SESSION_KEY = "gobert:session";
export const MIN_PASSWORD = 8;

export type Profile = MockUser;
export type Credentials = { phone?: string; email?: string; password: string };
type AuthResult = { error: string | null };
type SignInResult = AuthResult & { hasProfile: boolean; role: UserRole | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  /** Registered profile (null for guests and for users who haven't finished sign-up). */
  profile: Profile | null;
  profileLoading: boolean;
  role: UserRole | null;
  isMock: boolean;
  /** Method 1 — phone + SMS code */
  signInWithPhone: (phone: string) => Promise<AuthResult>;
  verifyOtp: (phone: string, token: string) => Promise<SignInResult>;
  resendOtp: (phone: string) => Promise<AuthResult>;
  /** Methods 2 & 3 — phone or email + password */
  signUpWithPassword: (c: Credentials) => Promise<AuthResult & { needsConfirmation: "sms" | "email" | null } & Partial<SignInResult>>;
  signInWithPassword: (c: Credentials) => Promise<SignInResult>;
  /** Method 3b — email magic link */
  sendMagicLink: (email: string, redirectTo: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string, redirectTo: string) => Promise<AuthResult>;
  signInAnonymous: () => Promise<AuthResult & { userId?: string }>;
  signOut: () => Promise<void>;
  completeRegistration: (input: { role: UserRole; full_name: string; email?: string; city?: string; language?: "fr" | "en" }) => Promise<AuthResult>;
  updateProfile: (patch: { full_name?: string; email?: string | null; city?: string; language?: "fr" | "en" }) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyError(message: string | undefined, fallback = "generic"): string {
  if (!message) return fallback;
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("too many") || m.includes("security purposes")) return "rate_limited";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "invalid_credentials";
  if (m.includes("already registered") || m.includes("already exists")) return "already_registered";
  if (m.includes("email not confirmed")) return "email_not_confirmed";
  if (m.includes("phone not confirmed")) return "phone_not_confirmed";
  if (m.includes("password") && (m.includes("short") || m.includes("weak") || m.includes("at least"))) return "weak_password";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "invalid_email";
  if (m.includes("blocked")) return "blocked";
  if (m.includes("invalid") || m.includes("expired") || m.includes("token")) return "invalid_otp";
  if (m.includes("network") || m.includes("fetch") || m.includes("abort")) return "network";
  if (m.includes("anonymous") && m.includes("disabled")) return "anonymous_disabled";
  if (m.includes("signups not allowed") || m.includes("provider is disabled") || m.includes("unsupported phone provider")) return "method_disabled";
  if (m.includes("sms")) return "sms_disabled";
  if (m.includes("phone") && m.includes("invalid")) return "invalid_phone";
  return fallback;
}

/** Stable mock user id so returning users get their account back (demo mode only). */
export function mockUserId(id: string) {
  return id.includes("@") ? `u-${id.toLowerCase().replace(/[^a-z0-9]/g, "")}` : `u-${id.replace(/\D/g, "")}`;
}

type StoredSession = { id: string; phone: string | null; email?: string | null; anonymous: boolean };

function makeMockSession(s: StoredSession): Session {
  const user = {
    id: s.id,
    phone: s.phone,
    email: s.email ?? undefined,
    is_anonymous: s.anonymous,
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as User;
  return { access_token: "mock", refresh_token: "mock", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user } as Session;
}

function readStored(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeStored(s: StoredSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable — session lives in memory only
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const loadProfile = useCallback(async (s: Session | null): Promise<Profile | null> => {
    if (!s || s.user.is_anonymous) {
      setProfile(null);
      return null;
    }
    setProfileLoading(true);
    try {
      const p = await getUser(s.user.id).catch((e) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      });
      setProfile(p);
      return p;
    } catch {
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (USE_MOCKS) {
      const stored = readStored();
      const s = stored ? makeMockSession(stored) : null;
      setSession(s);
      void loadProfile(s).finally(() => setLoading(false));
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadProfile(data.session).finally(() => setLoading(false));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") void loadProfile(s);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  /** If the current session is a guest, get a one-time code to move their trips to the account they sign into. */
  const guestCode = useCallback(async (): Promise<string | null> => {
    if (USE_MOCKS || !sessionRef.current?.user.is_anonymous) return null;
    return sb.createGuestTransfer().catch(() => null);
  }, []);

  const afterSignIn = useCallback(
    async (s: Session | null, code: string | null): Promise<SignInResult> => {
      setSession(s);
      if (code && s && !s.user.is_anonymous) await sb.redeemGuestTransfer(code).catch(() => 0);
      const p = await loadProfile(s);
      if (p?.is_blocked) {
        await supabase.auth.signOut().catch(() => undefined);
        setSession(null);
        setProfile(null);
        return { error: "blocked", hasProfile: false, role: null };
      }
      return { error: null, hasProfile: !!p, role: p?.role ?? null };
    },
    [loadProfile],
  );

  const mockSignIn = useCallback(
    async (key: string, contact: { phone?: string; email?: string }) => {
      const stored: StoredSession = { id: mockUserId(key), phone: contact.phone ?? null, email: contact.email ?? null, anonymous: false };
      writeStored(stored);
      return afterSignIn(makeMockSession(stored), null);
    },
    [afterSignIn],
  );

  // ------------------------------------------------ phone + SMS code
  const signInWithPhone = useCallback(async (phone: string): Promise<AuthResult> => {
    if (USE_MOCKS) return { error: null };
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error ? friendlyError(error.message) : null };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, token: string): Promise<SignInResult> => {
      if (!/^\d{6}$/.test(token)) return { error: "invalid_otp", hasProfile: false, role: null };
      if (USE_MOCKS) return mockSignIn(phone, { phone });
      const code = await guestCode();
      const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
      if (error) return { error: friendlyError(error.message), hasProfile: false, role: null };
      return afterSignIn(data.session, code);
    },
    [afterSignIn, guestCode, mockSignIn],
  );

  const resendOtp = signInWithPhone;

  // ------------------------------------------------ password (phone or email)
  const signUpWithPassword = useCallback<AuthContextValue["signUpWithPassword"]>(
    async (c) => {
      if (c.password.length < MIN_PASSWORD || !/[a-z]/i.test(c.password) || !/\d/.test(c.password)) return { error: "weak_password", needsConfirmation: null };
      if (USE_MOCKS) {
        const r = await mockSignIn(c.email ?? c.phone ?? "", { phone: c.phone, email: c.email });
        return { ...r, needsConfirmation: null };
      }
      const code = await guestCode();
      const { data, error } = c.email
        ? await supabase.auth.signUp({ email: c.email, password: c.password, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` } })
        : await supabase.auth.signUp({ phone: c.phone!, password: c.password });
      if (error) return { error: friendlyError(error.message), needsConfirmation: null };
      if (!data.session) return { error: null, needsConfirmation: c.email ? "email" : "sms" };
      const r = await afterSignIn(data.session, code);
      return { ...r, needsConfirmation: null };
    },
    [afterSignIn, guestCode, mockSignIn],
  );

  const signInWithPassword = useCallback<AuthContextValue["signInWithPassword"]>(
    async (c) => {
      if (!c.password) return { error: "invalid_credentials", hasProfile: false, role: null };
      if (USE_MOCKS) return mockSignIn(c.email ?? c.phone ?? "", { phone: c.phone, email: c.email });
      const code = await guestCode();
      const { data, error } = c.email
        ? await supabase.auth.signInWithPassword({ email: c.email, password: c.password })
        : await supabase.auth.signInWithPassword({ phone: c.phone!, password: c.password });
      if (error) return { error: friendlyError(error.message), hasProfile: false, role: null };
      return afterSignIn(data.session, code);
    },
    [afterSignIn, guestCode, mockSignIn],
  );

  // ------------------------------------------------ email magic link
  const sendMagicLink = useCallback(async (email: string, redirectTo: string): Promise<AuthResult> => {
    if (USE_MOCKS) return { error: null };
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: true } });
    return { error: error ? friendlyError(error.message) : null };
  }, []);

  const requestPasswordReset = useCallback(async (email: string, redirectTo: string): Promise<AuthResult> => {
    if (USE_MOCKS) return { error: null };
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error ? friendlyError(error.message) : null };
  }, []);

  // ------------------------------------------------ guests
  const signInAnonymous = useCallback(async (): Promise<AuthResult & { userId?: string }> => {
    if (USE_MOCKS) {
      const stored: StoredSession = { id: `anon-${crypto.randomUUID()}`, phone: null, anonymous: true };
      writeStored(stored);
      setSession(makeMockSession(stored));
      setProfile(null);
      return { error: null, userId: stored.id };
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return { error: friendlyError(error.message) };
    setSession(data.session);
    return { error: null, userId: data.user?.id };
  }, []);

  const signOut = useCallback(async () => {
    setProfile(null);
    if (USE_MOCKS) {
      writeStored(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const completeRegistration = useCallback<AuthContextValue["completeRegistration"]>(
    async (input) => {
      if (!session || session.user.is_anonymous) return { error: "generic" };
      try {
        const p = await registerUser({
          id: session.user.id,
          phone: session.user.phone ?? "",
          full_name: input.full_name,
          role: input.role,
          email: input.email || session.user.email || null,
          city: input.city,
          language: input.language,
        });
        setProfile(p);
        return { error: null };
      } catch (e) {
        return { error: friendlyError(e instanceof Error ? e.message : undefined) };
      }
    },
    [session],
  );

  const updateProfile = useCallback<AuthContextValue["updateProfile"]>(
    async (patch) => {
      if (!session || !profile) return { error: "generic" };
      try {
        setProfile(await updateUser({ id: session.user.id, ...patch }));
        return { error: null };
      } catch (e) {
        return { error: friendlyError(e instanceof Error ? e.message : undefined) };
      }
    },
    [session, profile],
  );

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isAnonymous: !!session?.user?.is_anonymous,
      profile,
      profileLoading,
      role: profile?.role ?? null,
      isMock: USE_MOCKS,
      signInWithPhone,
      verifyOtp,
      resendOtp,
      signUpWithPassword,
      signInWithPassword,
      sendMagicLink,
      requestPasswordReset,
      signInAnonymous,
      signOut,
      completeRegistration,
      updateProfile,
      refreshProfile,
    }),
    [
      session,
      loading,
      profile,
      profileLoading,
      signInWithPhone,
      verifyOtp,
      resendOtp,
      signUpWithPassword,
      signInWithPassword,
      sendMagicLink,
      requestPasswordReset,
      signInAnonymous,
      signOut,
      completeRegistration,
      updateProfile,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
