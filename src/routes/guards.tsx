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
    async function checkRole() {
      if (!user) {
        setRedirectPath("/auth");
        return;
      }
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase
          .from("system_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) {
          setRedirectPath("/my-schedule");
          return;
        }
        if (data?.role === "teamleder" || data?.role === "ejer") {
          setRedirectPath("/shift-planning");
        } else {
          setRedirectPath("/my-schedule");
        }
      } catch {
        setRedirectPath("/my-schedule");
      }
    }
    if (!loading) checkRole();
  }, [user, loading]);

  if (loading || !redirectPath) return <PageLoader />;
  return <Navigate to={redirectPath} replace />;
}

export function wrapWithGuard(
  Component: React.LazyExoticComponent<React.ComponentType<any>>,
  meta: RouteConfig
) {
  const element = React.createElement(Component);
  if (meta.access === "public") return element;
  if (meta.access === "auth") return <AuthRoute>{element}</AuthRoute>;
  if (meta.access === "protected") return <ProtectedRoute>{element}</ProtectedRoute>;
  if (meta.access === "role") {
    if (meta.requiredRole) {
      return <RoleProtectedRoute requiredRole={meta.requiredRole}>{element}</RoleProtectedRoute>;
    }
    if (meta.requireTeamlederOrAbove) {
      return <RoleProtectedRoute requireTeamlederOrAbove>{element}</RoleProtectedRoute>;
    }
    return <RoleProtectedRoute>{element}</RoleProtectedRoute>;
  }
  return element;
}
