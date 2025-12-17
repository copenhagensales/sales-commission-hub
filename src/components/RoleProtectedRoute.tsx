import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCanAccess } from "@/hooks/useSystemRoles";
import { usePermissions } from "@/hooks/usePositionPermissions";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "teamleder" | "ejer" | "rekruttering";
  requireTeamlederOrAbove?: boolean;
  requireRekrutteringOrAbove?: boolean;
  positionPermission?: string; // Position-based permission key to check
}

export function RoleProtectedRoute({ 
  children, 
  requiredRole,
  requireTeamlederOrAbove = false,
  requireRekrutteringOrAbove = false,
  positionPermission,
}: RoleProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: roleLoading, role, isTeamlederOrAbove, isOwner, isRekruttering, isRekrutteringOrAbove } = useCanAccess();
  const { isLoading: permLoading, canView } = usePermissions();
  
  // Wait for auth, role, and permissions to fully load
  const isLoading = authLoading || roleLoading || permLoading;
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user has position-based permission for this route
  const hasPositionAccess = positionPermission ? canView(positionPermission) : false;

  // Check role requirements
  if (requiredRole === "ejer" && !isOwner) {
    return <Navigate to="/my-schedule" replace />;
  }

  if (requiredRole === "rekruttering" && !isRekruttering && !isOwner) {
    return <Navigate to="/my-schedule" replace />;
  }

  // requireTeamlederOrAbove: allow if system role qualifies OR if position permission grants access
  if (requireTeamlederOrAbove && !isTeamlederOrAbove && !isRekruttering && !hasPositionAccess) {
    return <Navigate to="/my-schedule" replace />;
  }

  if (requireRekrutteringOrAbove && !isRekrutteringOrAbove && !hasPositionAccess) {
    return <Navigate to="/my-schedule" replace />;
  }

  if (requiredRole === "teamleder" && role !== "teamleder" && role !== "ejer" && !hasPositionAccess) {
    return <Navigate to="/my-schedule" replace />;
  }
  
  return <>{children}</>;
}

// Simple protected route that just checks auth (for employee-accessible pages)
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}
