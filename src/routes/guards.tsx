import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { ProtectedRoute, RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import type { RouteConfig } from "./types";

export function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-foreground">Indlæser...</div>
    </div>
  );
}

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/my-schedule" replace />;
  return <>{children}</>;
}

export function SmartRedirect() {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function checkLandingPage() {
      if (!user) {
        setRedirectPath("/auth");
        return;
      }
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        
        // Get employee with their individual override and position default
        const { data: employee } = await supabase
          .from("employee_master_data")
          .select(`
            default_landing_page,
            job_title,
            job_positions!employee_master_data_job_title_fkey(default_landing_page)
          `)
          .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
          .eq("is_active", true)
          .maybeSingle();
        
        // Priority: 1. Employee override, 2. Position default, 3. "/home"
        if (employee?.default_landing_page) {
          setRedirectPath(employee.default_landing_page);
          return;
        }
        
        const positionDefault = (employee?.job_positions as any)?.default_landing_page;
        if (positionDefault) {
          setRedirectPath(positionDefault);
          return;
        }
        
        setRedirectPath("/home");
      } catch {
        setRedirectPath("/home");
      }
    }
    if (!loading) checkLandingPage();
  }, [user, loading]);

  if (loading || !redirectPath) return <PageLoader />;
  return <Navigate to={redirectPath} replace />;
}

export function wrapWithGuard(
  Component: React.ComponentType<any> | React.LazyExoticComponent<React.ComponentType<any>>,
  meta: RouteConfig
) {
  const element = React.createElement(Component);
  if (meta.access === "public") return element;
  if (meta.access === "auth") return <AuthRoute>{element}</AuthRoute>;
  if (meta.access === "protected") return <ProtectedRoute>{element}</ProtectedRoute>;
  if (meta.access === "role") {
    // Only use position permissions - system roles are no longer used
    return <RoleProtectedRoute positionPermission={meta.positionPermission}>{element}</RoleProtectedRoute>;
  }
  return element;
}
