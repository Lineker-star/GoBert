"use client";
import dynamic from "next/dynamic";
import AppShell, { RequireAuth } from "@/components/ui/AppShell";
import { PageLoader } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";

// Each account type only downloads its own dashboard.
const CustomerDashboard = dynamic(() => import("@/components/dashboard/CustomerDashboard"), { loading: () => <PageLoader /> });
const RiderDashboard = dynamic(() => import("@/components/dashboard/RiderDashboard"), { loading: () => <PageLoader /> });
const BusinessDashboard = dynamic(() => import("@/components/dashboard/BusinessDashboard"), { loading: () => <PageLoader /> });

/** One URL, three experiences: the dashboard is chosen from the role picked at registration. */
export default function DashboardPage() {
  return (
    <RequireAuth allowGuest allowVisitor>
      <AppShell wide>
        <RoleDashboard />
      </AppShell>
    </RequireAuth>
  );
}

function RoleDashboard() {
  const { role } = useAuth();
  if (role === "rider") return <RiderDashboard />;
  if (role === "business") return <BusinessDashboard />;
  return <CustomerDashboard />;
}
