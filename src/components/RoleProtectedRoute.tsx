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
  const { isLoading: permLoading, canView, permissions, position } = usePermissions();
  
  // Wait for auth, role, and permissions to fully load
  const isLoading = authLoading || roleLoading || permLoading;
  
  // Debug logging
  console.log("RoleProtectedRoute DEBUG:", {
    userEmail: user?.email,
    positionPermission,
    position: position?.name,
    permissions,
    isLoading,
    authLoading,
    roleLoading,
    permLoading,
  });
  
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

  // PRIORITY: Position-based permissions take precedence
  // If positionPermission is specified and user has that permission, grant access immediately
  const hasPositionAccess = positionPermission ? canView(positionPermission) : false;
  
  console.log("RoleProtectedRoute ACCESS CHECK:", {
    positionPermission,
    hasPositionAccess,
    permissionValue: positionPermission ? permissions[positionPermission] : null,
    isOwner,
    role,
  });
  
  if (hasPositionAccess) {
    console.log("RoleProtectedRoute: GRANTED via position permission");
    return <>{children}</>;
  }

  // Fallback to system role checks if no position permission granted
  
  // Owner has access to everything
  if (isOwner) {
    console.log("RoleProtectedRoute: GRANTED via owner role");
    return <>{children}</>;
  }

  // Check specific role requirements
  if (requiredRole === "ejer") {
    console.log("RoleProtectedRoute: DENIED - requires ejer");
    return <Navigate to="/my-schedule" replace />;
  }

  if (requiredRole === "rekruttering" && !isRekruttering) {
    console.log("RoleProtectedRoute: DENIED - requires rekruttering");
    return <Navigate to="/my-schedule" replace />;
  }

  if (requiredRole === "teamleder" && role !== "teamleder") {
    console.log("RoleProtectedRoute: DENIED - requires teamleder");
    return <Navigate to="/my-schedule" replace />;
  }

  // Check teamleder or above requirement
  if (requireTeamlederOrAbove && !isTeamlederOrAbove && !isRekruttering) {
    console.log("RoleProtectedRoute: DENIED - requires teamlederOrAbove");
    return <Navigate to="/my-schedule" replace />;
  }

  if (requireRekrutteringOrAbove && !isRekrutteringOrAbove) {
    console.log("RoleProtectedRoute: DENIED - requires rekrutteringOrAbove");
    return <Navigate to="/my-schedule" replace />;
  }
  
  console.log("RoleProtectedRoute: GRANTED via system role fallback");
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
