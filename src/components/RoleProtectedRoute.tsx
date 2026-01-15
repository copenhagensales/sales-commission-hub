import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  positionPermission?: string; // Position-based permission key to check
}

/**
 * RoleProtectedRoute - Uses ONLY position-based permissions from job_positions table.
 * System roles are NO LONGER used for access control.
 * Position permissions are the single source of truth.
 */
export function RoleProtectedRoute({ 
  children, 
  positionPermission,
}: RoleProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: permLoading, canView, permissions, position } = usePermissions();
  
  const isLoading = authLoading || permLoading;
  
  // Debug logging
  console.log("RoleProtectedRoute DEBUG:", {
    userEmail: user?.email,
    positionPermission,
    position: position?.name,
    permissions,
    isLoading,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="mt-4">
          <LogOut className="h-4 w-4 mr-2" />
          Log ud
        </Button>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // User must have a position defined
  if (!position) {
    console.log("RoleProtectedRoute: DENIED - no position found for user");
    return <Navigate to="/my-schedule" replace />;
  }

  // If no specific permission required, grant access (authenticated route)
  if (!positionPermission) {
    console.log("RoleProtectedRoute: GRANTED - no specific permission required");
    return <>{children}</>;
  }

  // Check position permission
  const hasAccess = canView(positionPermission);
  
  console.log("RoleProtectedRoute ACCESS CHECK:", {
    positionPermission,
    hasAccess,
    permissionValue: permissions[positionPermission],
  });
  
  if (hasAccess) {
    console.log("RoleProtectedRoute: GRANTED via position permission");
    return <>{children}</>;
  }

  console.log("RoleProtectedRoute: DENIED - permission not granted");
  return <Navigate to="/my-schedule" replace />;
}

// Simple protected route that just checks auth AND active employee status
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: permLoading, position } = usePermissions();
  
  const isLoading = authLoading || permLoading;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };
  
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

  // Check if employee is active (has a position)
  if (!position) {
    console.log("ProtectedRoute: User deactivated - signing out");
    // Sign out deactivated users
    handleLogout();
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-muted-foreground">Din konto er deaktiveret. Logger ud...</div>
      </div>
    );
  }
  
  return <>{children}</>;
}
