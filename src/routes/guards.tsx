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
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function SmartRedirect() {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    async function checkLandingPage() {
      if (!user) {
        if (isMounted) setRedirectPath("/auth");
        return;
      }
      
      // Set a timeout to prevent infinite hang on slow DB
      timeoutId = setTimeout(() => {
        if (isMounted && !redirectPath) {
          console.warn("SmartRedirect: Landing page check timed out, defaulting to /home");
          setRedirectPath("/home");
        }
      }, 5000);

      try {
        const { supabase } = await import("@/integrations/supabase/client");
        
        // Get employee with their individual override and position default
        const lowerEmail = user.email?.toLowerCase() || '';
        const { data: employee } = await supabase
          .from("employee_master_data")
          .select("default_landing_page, job_title")
          .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
          .eq("is_active", true)
          .maybeSingle();
        
        if (!isMounted) return;
        
        // Priority: 1. Employee override, 2. Position default, 3. "/home"
        if (employee?.default_landing_page) {
          setRedirectPath(employee.default_landing_page);
          return;
        }
        
        // Get position default landing page if employee has job_title
        if (employee?.job_title) {
          const { data: position } = await supabase
            .from("job_positions")
            .select("default_landing_page")
            .eq("name", employee.job_title)
            .maybeSingle();
          
          if (!isMounted) return;
          
          if (position?.default_landing_page) {
            setRedirectPath(position.default_landing_page);
            return;
          }
        }
        
        setRedirectPath("/home");
      } catch {
        if (isMounted) setRedirectPath("/home");
      }
    }
    
    if (!loading) checkLandingPage();
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, loading, redirectPath]);

  if (loading || !redirectPath) return <PageLoader />;
  return <Navigate to={redirectPath} replace />;
}

export function wrapWithGuard(
  Component: React.ComponentType,
  meta: RouteConfig
): React.ReactElement {
  const element = React.createElement(Component);
  if (meta.access === "public") return element;
  if (meta.access === "auth") return <AuthRoute>{element}</AuthRoute>;
  if (meta.access === "protected") return <ProtectedRoute>{element}</ProtectedRoute>;
  if (meta.access === "role") {
    return <RoleProtectedRoute positionPermission={meta.positionPermission}>{element}</RoleProtectedRoute>;
  }
  return element;
}
