import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCanViewDashboard, useAccessibleDashboards } from "@/hooks/useTeamDashboardPermissions";
import { toast } from "sonner";

/**
 * Runtime access check for dashboards.
 * Redirects unauthorized users to the dashboard overview or their first accessible dashboard.
 * 
 * Usage:
 * ```tsx
 * const { canView, isLoading } = useRequireDashboardAccess("cph-sales");
 * if (isLoading) return <LoadingSpinner />;
 * if (!canView) return null; // Redirect handled by hook
 * ```
 */
export function useRequireDashboardAccess(dashboardSlug: string) {
  const navigate = useNavigate();
  const { canView, isLoading: canViewLoading } = useCanViewDashboard(dashboardSlug);
  const { isLoading: accessLoading, data: accessibleDashboards = [] } = useAccessibleDashboards();

  // Kombiner begge loading states for at undgå race conditions
  const isLoading = canViewLoading || accessLoading;

  useEffect(() => {
    // Kun redirect efter data er fuldt loaded og vi bekræfter ingen adgang
    if (!isLoading && !canView) {
      toast.error("Du har ikke adgang til dette dashboard");
      
      // Redirect til første tilgængelige dashboard eller oversigt
      if (accessibleDashboards.length > 0) {
        navigate(accessibleDashboards[0].path, { replace: true });
      } else {
        navigate("/dashboards", { replace: true });
      }
    }
  }, [isLoading, canView, navigate, accessibleDashboards]);

  return { canView, isLoading };
}
