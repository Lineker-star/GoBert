"use client";
import AppShell, { RequireAuth } from "@/components/ui/AppShell";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";
import RiderDashboard from "@/components/dashboard/RiderDashboard";
import BusinessDashboard from "@/components/dashboard/BusinessDashboard";
import { useAuth } from "@/lib/auth";

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
