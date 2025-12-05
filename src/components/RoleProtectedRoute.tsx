import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCanAccess } from "@/hooks/useSystemRoles";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "teamleder" | "ejer";
  requireTeamlederOrAbove?: boolean;
}

export function RoleProtectedRoute({ 
  children, 
  requiredRole,
  requireTeamlederOrAbove = false 
}: RoleProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: roleLoading, role, isTeamlederOrAbove, isOwner } = useCanAccess();
  
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check role requirements
  if (requiredRole === "ejer" && !isOwner) {
    return <Navigate to="/my-schedule" replace />;
  }

  if (requireTeamlederOrAbove && !isTeamlederOrAbove) {
    return <Navigate to="/my-schedule" replace />;
  }

  if (requiredRole === "teamleder" && role !== "teamleder" && role !== "ejer") {
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
