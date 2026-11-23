"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

type AuthResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAnonymous: boolean;
  signInWithPhone: (phone: string) => Promise<AuthResult>;
  verifyOtp: (phone: string, token: string) => Promise<AuthResult>;
  resendOtp: (phone: string) => Promise<AuthResult>;
  signInAnonymous: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyError(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  const m = message.toLowerCase();
  if (m.includes("rate") || m.includes("too many") || m.includes("security")) return "rate_limited";
  if (m.includes("invalid") || m.includes("expired") || m.includes("token")) return "invalid_otp";
  if (m.includes("network") || m.includes("fetch")) return "network";
  if (m.includes("anonymous") && m.includes("disabled")) return "anonymous_disabled";
  if (m.includes("sms") && m.includes("disabled")) return "sms_disabled";
  if (m.includes("phone provider") || m.includes("unsupported")) return "sms_disabled";
  if (m.includes("phone") && m.includes("invalid")) return "invalid_phone";
  return "generic";
}

// Mock session for demo/screenshots when NEXT_PUBLIC_USE_MOCKS=true.
function makeMockSession(anonymous: boolean): Session {
  const user = {
    id: anonymous ? "mock-anon" : "mock-user",
    phone: anonymous ? null : "+237699000001",
    is_anonymous: anonymous,
    user_metadata: { full_name: anonymous ? "" : "Mbarga Jean" },
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as User;
  return {
    access_token: "mock",
    refresh_token: "mock",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user,
  } as Session;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (USE_MOCKS) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithPhone = async (_phone: string): Promise<AuthResult> => {
    if (USE_MOCKS) return { error: null };
    const { error } = await supabase.auth.signInWithOtp({ phone: _phone });
    return { error: error ? friendlyError(error.message, "generic") : null };
  };

  const verifyOtp = async (phone: string, _token: string): Promise<AuthResult> => {
    if (USE_MOCKS) {
      setSession(makeMockSession(false));
      return { error: null };
    }
    const { error } = await supabase.auth.verifyOtp({ phone, token: _token, type: "sms" });
    return { error: error ? friendlyError(error.message, "generic") : null };
  };

  const resendOtp = async (phone: string): Promise<AuthResult> => {
    if (USE_MOCKS) return { error: null };
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error ? friendlyError(error.message, "generic") : null };
  };

  const signInAnonymous = async (): Promise<AuthResult> => {
    if (USE_MOCKS) {
      setSession(makeMockSession(true));
      return { error: null };
    }
    const { error } = await supabase.auth.signInAnonymously();
    return { error: error ? friendlyError(error.message, "generic") : null };
  };

  const signOut = async () => {
    if (USE_MOCKS) {
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        isAnonymous: !!session?.user?.is_anonymous,
        signInWithPhone,
        verifyOtp,
        resendOtp,
        signInAnonymous,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}