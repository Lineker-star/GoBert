"use client";
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/ui/AppShell";
import TripPlanner from "@/components/booking/TripPlanner";
import { useAuth } from "@/lib/auth";

/** Home = the booking map. Guests can book right away; riders and businesses land on their dashboard. */
export default function HomePage() {
  const { role } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  useEffect(() => {
    if (role === "rider" || role === "business") router.replace(`/${locale}/dashboard`);
  }, [role, router, locale]);
  return (
    <AppShell fullBleed>
      <TripPlanner />
    </AppShell>
  );
}
