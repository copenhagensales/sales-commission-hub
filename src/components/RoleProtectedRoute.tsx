import { useState, useEffect } from "react";
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
  const { isLoading: permLoading, isReady, canView, permissions, position } = usePermissions();
  
  // CRITICAL: Wait until BOTH auth is done AND permissions are READY (fully fetched)
  // Using isReady prevents premature redirects during browser refresh
  const isLoading = authLoading || !isReady;
  
  // Debug logging
  console.log("RoleProtectedRoute DEBUG:", {
    userEmail: user?.email,
    positionPermission,
    position: position?.name,
    permissions,
    isLoading,
    isReady,
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
    return <Navigate to="/home" replace />;
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
  return <Navigate to="/home" replace />;
}

// Simple protected route that just checks auth AND active employee status
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isLoading: permLoading, isReady, position, isError, isRetrying } = usePermissions();
  const [retryCountdown, setRetryCountdown] = useState(15);
  
  // Include isRetrying in loading check - prevents false "deactivated" during DB retries
  // Also wait for isReady to prevent premature redirects on browser refresh
  const isLoading = authLoading || permLoading || isRetrying || !isReady;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  const handleRetry = () => {
    window.location.reload();
  };
  
  // Check if we're offline
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  
  // Basic pages that can work in limited mode
  const basicPages = ['/home', '/my-schedule', '/my-profile'];
  const isBasicPage = basicPages.some(p => window.location.pathname.startsWith(p));
  
  // Auto-retry countdown when database is down
  useEffect(() => {
    if (isError && !isRetrying && !isOffline) {
      const interval = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            window.location.reload();
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setRetryCountdown(15);
    }
  }, [isError, isRetrying, isOffline]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="animate-pulse text-muted-foreground">
          {isRetrying ? 'Forbinder til database...' : 'Indlæser...'}
        </div>
        {isRetrying && (
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            Systemet oplever langsom forbindelse. Vent venligst...
          </p>
        )}
      </div>
    );
  }
  
  // Handle offline state
  if (isOffline) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-amber-600 font-medium text-lg">Ingen internetforbindelse</div>
        <p className="text-muted-foreground text-sm max-w-md text-center">
          Tjek din internetforbindelse og prøv igen.
        </p>
        <Button onClick={handleRetry}>
          Prøv igen
        </Button>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Handle database error/timeout - show retry option with countdown
  // If on a basic page, allow limited access instead of blocking
  if (isError) {
    console.log("ProtectedRoute: Database error - showing retry option (NOT deactivated!)");
    
    // For basic pages, allow access with warning banner
    if (isBasicPage && position) {
      return (
        <>
          <div className="bg-amber-500/10 border-b border-amber-500/50 p-2 text-center text-sm text-amber-700 dark:text-amber-400">
            Systemet kører i begrænset tilstand. Nogle funktioner er midlertidigt utilgængelige.
          </div>
          {children}
        </>
      );
    }
    
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-destructive font-medium text-lg">Database forbindelse mislykkedes</div>
        <p className="text-muted-foreground text-sm max-w-md text-center">
          Systemet oplever midlertidige forbindelsesproblemer.<br />
          <strong>Din konto er IKKE deaktiveret</strong> - dette er en teknisk fejl.
        </p>
        <p className="text-xs text-muted-foreground">
          Prøver automatisk igen om {retryCountdown} sekunder...
        </p>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleRetry}>
            Prøv igen nu
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Log ud
          </Button>
        </div>
      </div>
    );
  }

  // Only if NO error and NO position = genuinely deactivated user
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
