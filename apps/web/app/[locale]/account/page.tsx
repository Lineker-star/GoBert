"use client";
import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { supabase } from "@/lib/supabase";
import { LogOut, User, Globe, MapPin, ChevronRight } from "lucide-react";

export default function AccountPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { session, user, loading: authLoading, isAnonymous, signOut } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const userId = isAnonymous ? null : user?.id ?? null;
  const { places } = useSavedPlaces(userId, null);

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.full_name ?? "");
    }
  }, [user]);

  const changeLocale = (loc: string) => {
    if (loc === locale) return;
    router.replace(`/${loc}/account`);
  };

  const saveName = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    await supabase.auth.updateUser({ data: { full_name: name } });
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }, [user, name]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace(`/${locale}/auth`);
  }, [signOut, locale, router]);

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="h-6 w-24 rounded-full bg-grey animate-pulse" />
      </main>
    );
  }

  if (!session || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-ivory">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 text-center">
          <User className="w-10 h-10 mx-auto text-charcoal/40 mb-3" />
          <h1 className="text-xl font-bold text-green mb-2">{t("account.title")}</h1>
          <p className="text-sm text-charcoal/60 mb-6">{t("account.signedOut")}</p>
          <Link
            href={`/${locale}/auth`}
            className="block bg-orange text-white rounded-xl py-3 font-semibold"
          >
            {t("account.signIn")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ivory p-6">
      <div className="max-w-sm mx-auto space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-green/10 flex items-center justify-center">
              <User className="w-6 h-6 text-green" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-green">{t("account.title")}</h1>
              <p className="text-xs text-charcoal/50">
                {isAnonymous ? t("account.anonymous") : user.phone ?? ""}
              </p>
            </div>
          </div>

          {isAnonymous ? (
            <div className="bg-orange/10 border border-orange/20 rounded-xl p-3 mb-4">
              <p className="text-xs text-orange">{t("account.anonymousHint")}</p>
              <Link
                href={`/${locale}/auth`}
                className="inline-block mt-2 text-sm font-medium text-green"
              >
                {t("account.signIn")} →
              </Link>
            </div>
          ) : (
            <div className="mb-4">
              <label className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
                {t("account.name")}
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("account.namePlaceholder")}
                  className="flex-1 border border-grey rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green"
                />
                <button
                  onClick={saveName}
                  disabled={saving}
                  className="bg-green text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? t("account.saving") : savedMsg ? t("account.saved") : t("account.save")}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-charcoal/50" />
            <span className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
              {t("account.language")}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => changeLocale("fr")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium border ${
                locale === "fr" ? "bg-green border-green text-green" : "border-grey text-charcoal"
              }`}
            >
              Français
            </button>
            <button
              onClick={() => changeLocale("en")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium border ${
                locale === "en" ? "bg-green border-green text-green" : "border-grey text-charcoal"
              }`}
            >
              English
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-charcoal/50" />
            <span className="text-xs font-semibold text-charcoal/70 uppercase tracking-wider">
              {t("account.savedPlaces")}
            </span>
          </div>
          <div className="space-y-1">
            {places.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-grey/40">
                <MapPin className="w-4 h-4 text-green shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-charcoal">{p.label}</div>
                  {p.address && (
                    <div className="text-xs text-charcoal/50 truncate">{p.address}</div>
                  )}
                </div>
              </div>
            ))}
            {places.length === 0 && (
              <p className="text-xs text-charcoal/40 px-3 py-2">{t("saved.empty")}</p>
            )}
          </div>
        </div>

        <Link
          href={`/${locale}/provider/onboard`}
          className="flex items-center gap-2 bg-white rounded-2xl shadow-sm p-5 hover:bg-charcoal/5 transition"
        >
          <div className="w-10 h-10 rounded-full bg-orange/10 flex items-center justify-center">
            <ChevronRight className="w-5 h-5 text-orange" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-charcoal">{t("account.becomeProvider")}</div>
          </div>
        </Link>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full bg-white rounded-2xl shadow-sm p-5 text-orange hover:bg-orange/5 transition"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">{t("account.signOut")}</span>
        </button>
      </div>
    </main>
  );
}