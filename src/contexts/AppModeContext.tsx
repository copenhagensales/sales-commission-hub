import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAccessibleDashboards } from "@/hooks/useTeamDashboardPermissions";

export type AppMode = "main" | "dashboard";

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  switchToMain: () => void;
  switchToDashboard: () => void;
  canAccessDashboards: boolean;
  canAccessMainSystem: boolean;
  firstAvailableDashboard: string | null;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

const STORAGE_KEY = "app-mode-preference";

export function AppModeProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Team-based dashboard permissions (replaces role-based)
  const { data: accessibleDashboards = [] } = useAccessibleDashboards();
  
  const canAccessDashboards = accessibleDashboards.length > 0;
  const canAccessMainSystem = true; // All authenticated users can access main system
  const firstAvailableDashboard = accessibleDashboards[0]?.path || null;
  
  // Determine initial mode based on current path
  const getInitialMode = (): AppMode => {
    const isDashboardRoute = location.pathname.startsWith("/dashboards");
    if (isDashboardRoute && canAccessDashboards) {
      return "dashboard";
    }
    
    // Check localStorage preference
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dashboard" && canAccessDashboards) {
      return "dashboard";
    }
    
    return "main";
  };
  
  const [mode, setModeState] = useState<AppMode>(getInitialMode);
  
  // Sync mode with current route
  useEffect(() => {
    const isDashboardRoute = location.pathname.startsWith("/dashboards");
    if (isDashboardRoute && canAccessDashboards && mode !== "dashboard") {
      setModeState("dashboard");
    } else if (!isDashboardRoute && mode === "dashboard" && !location.pathname.startsWith("/tv/") && !location.pathname.startsWith("/t/")) {
      // Only switch back to main if we're not on a dashboard route
      // and not on TV board routes
    }
  }, [location.pathname, canAccessDashboards, mode]);
  
  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };
  
  const switchToMain = () => {
    setMode("main");
    navigate("/home");
  };
  
  const switchToDashboard = () => {
    setMode("dashboard");
    navigate("/dashboards");
  };
  
  return (
    <AppModeContext.Provider value={{
      mode,
      setMode,
      switchToMain,
      switchToDashboard,
      canAccessDashboards,
      canAccessMainSystem,
      firstAvailableDashboard,
    }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error("useAppMode must be used within an AppModeProvider");
  }
  return context;
}
