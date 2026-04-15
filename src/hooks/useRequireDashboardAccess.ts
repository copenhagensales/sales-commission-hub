import { useEffect, useRef } from "react";
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
export function useRequireDashboardAccess(dashboardSlug: string, options?: { skip?: boolean }) {
  const skip = options?.skip ?? false;
  const navigate = useNavigate();
  const { canView, isLoading: canViewLoading } = useCanViewDashboard(dashboardSlug);
  const { isLoading: accessLoading, data: accessibleDashboards = [] } = useAccessibleDashboards();

  // Track the slug to detect navigation between dashboards
  const currentSlugRef = useRef(dashboardSlug);
  const hasRedirectedRef = useRef(false);

  // Reset redirect flag when slug changes (user navigated to new dashboard)
  useEffect(() => {
    if (currentSlugRef.current !== dashboardSlug) {
      currentSlugRef.current = dashboardSlug;
      hasRedirectedRef.current = false;
    }
  }, [dashboardSlug]);

  const isLoading = skip ? false : (canViewLoading || accessLoading);

  useEffect(() => {
    if (skip) return;
    // Don't redirect if already redirected for this slug
    if (hasRedirectedRef.current) return;
    
    // Only redirect after data is fully loaded and we confirm no access
    if (!isLoading && !canView) {
      hasRedirectedRef.current = true;
      toast.error("Du har ikke adgang til dette dashboard");
      
      if (accessibleDashboards.length > 0) {
        navigate(accessibleDashboards[0].path, { replace: true });
      } else {
        navigate("/dashboards", { replace: true });
      }
    }
  }, [isLoading, canView, navigate, accessibleDashboards, dashboardSlug, skip]);

  return { canView: skip ? true : canView, isLoading };
}
