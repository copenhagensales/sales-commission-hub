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
  const canView = useCanViewDashboard(dashboardSlug);
  const { isLoading, data: accessibleDashboards = [] } = useAccessibleDashboards();

  useEffect(() => {
    // Only redirect after loading is complete and we confirmed no access
    if (!isLoading && !canView) {
      toast.error("Du har ikke adgang til dette dashboard");
      
      // Redirect to first accessible dashboard or overview
      if (accessibleDashboards.length > 0) {
        navigate(accessibleDashboards[0].path, { replace: true });
      } else {
        navigate("/dashboards", { replace: true });
      }
    }
  }, [isLoading, canView, navigate, accessibleDashboards]);

  return { canView, isLoading };
}
