import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Monitor, LogOut, Home, Settings, PanelLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_LIST } from "@/config/dashboards";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

interface DashboardSidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function DashboardSidebar({ isMobile = false, onNavigate, isCollapsed = false, onToggle }: DashboardSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canView, isLoading } = useUnifiedPermissions();

  // Filter dashboards based on permissions
  const accessibleDashboards = DASHBOARD_LIST.filter(dashboard => {
    if (!dashboard.permissionKey) return true;
    return canView(dashboard.permissionKey);
  });

  const handleLogout = async () => {
    queryClient.clear();
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') || key.includes('supabase')
    );
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error:", e);
    }
    
    navigate("/auth");
  };

  const handleNavClick = () => {
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

  const handleGoToMain = () => {
    handleNavClick();
    navigate("/home");
  };

  const sidebarClasses = isMobile 
    ? "h-full w-full bg-sidebar overflow-y-auto" 
    : cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar overflow-y-auto transition-all duration-300 ease-in-out",
        isCollapsed ? "w-0 -translate-x-full opacity-0" : "w-64 translate-x-0 opacity-100"
      );

  if (isLoading) {
    return (
      <aside className={sidebarClasses}>
        <div className="flex h-full flex-col">
          {!isMobile && (
            <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
              <div className="flex items-center px-3 py-2 rounded-lg">
                <img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" />
              </div>
            </div>
          )}
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Indlæser...</div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={sidebarClasses}>
      <div className="flex h-full flex-col">
        {/* Header with centered logo and collapse button */}
        {!isMobile && (
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-3">
            {/* Spacer for symmetry */}
            <div className="w-9" />
            
            {/* Centered logo */}
            <div 
              onClick={() => navigate(accessibleDashboards[0]?.path || "/home")} 
              className="flex items-center justify-center px-2 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/50"
            >
              <img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" />
            </div>
            
            {/* Collapse button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onToggle}
                  className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent/50"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Skjul sidebar</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Hovedsystem button - Desktop only */}
        {!isMobile && (
          <div className="px-4 pt-4">
            <Button 
              onClick={handleGoToMain}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              <Home className="h-4 w-4" />
              Hovedsystem
            </Button>
          </div>
        )}

        {/* Mobile: Show home button at top */}
        {isMobile && (
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <img src={cphSalesLogo} alt="CPH Sales" className="h-8 w-auto object-contain" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGoToMain}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Hovedsystem
            </Button>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {/* Section Header */}
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Dashboards
          </div>

          {/* Dashboard Links */}
          {accessibleDashboards.map((dashboard) => (
            <NavLink
              key={dashboard.slug}
              to={dashboard.path}
              onClick={handleNavClick}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border-l-4",
                  isActive
                    ? "bg-primary/15 text-primary border-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent hover:border-sidebar-accent"
                )
              }
            >
              <LayoutDashboard className="h-4 w-4" />
              {dashboard.name}
            </NavLink>
          ))}

          {/* Administration Section */}
          {(canView("menu_tv_board_admin") || canView("menu_dashboard_settings")) && (
            <>
              <div className="px-3 py-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Administration
              </div>
              
              {canView("menu_tv_board_admin") && (
                <NavLink
                  to="/admin/tv-boards"
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border-l-4",
                      isActive
                        ? "bg-primary/15 text-primary border-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent hover:border-sidebar-accent"
                    )
                  }
                >
                  <Monitor className="h-4 w-4" />
                  TV Boards
                </NavLink>
              )}

              {canView("menu_dashboard_settings") && (
                <NavLink
                  to="/dashboards/settings"
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all border-l-4",
                      isActive
                        ? "bg-primary/15 text-primary border-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-transparent hover:border-sidebar-accent"
                    )
                  }
                >
                  <Settings className="h-4 w-4" />
                  Indstillinger
                </NavLink>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Log ud
          </button>
        </div>
      </div>
    </aside>
  );
}
