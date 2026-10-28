import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RouteSkeleton } from "@/components/mobile";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
import Opstartshold from "@/pages/reports/Opstartshold";

/** Opstartshold som dashboard; adgang via team_dashboard_permissions (slug "opstartshold") og ejer. */
export default function OpstartsholdDashboard() {
  const { canView, isLoading } = useRequireDashboardAccess("opstartshold");
  if (isLoading) return <RouteSkeleton />;
  if (!canView) return null;
  return (
    <div className="space-y-4 p-2 md:p-6 min-w-0">
      <DashboardHeader title="Opstartshold" subtitle="Eesy TM – de første arbejdsdage pr. hold" />
      <Opstartshold />
    </div>
  );
}
