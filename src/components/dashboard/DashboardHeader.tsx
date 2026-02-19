import { useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutGrid, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TvBoardQuickGenerator } from "./TvBoardQuickGenerator";
import { DASHBOARD_LIST } from "@/config/dashboards";
import { useTvBoardContext } from "@/contexts/TvBoardContext";
import { useAccessibleDashboards } from "@/hooks/useTeamDashboardPermissions";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: ReactNode;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function DashboardHeader({ title, subtitle, rightContent, onFullscreenChange }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { overrideSlug } = useTvBoardContext();
  const isTvBoardMode = !!overrideSlug;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  
  // Use team-based dashboard permissions instead of role-based permissions
  const { data: accessibleDashboards = [] } = useAccessibleDashboards();
  const { isOwner, isTeamleder } = useUnifiedPermissions();
  const canCreateTvLink = isOwner || isTeamleder;


  const currentDashboardSlug = useMemo(() => {
    const dashboard = DASHBOARD_LIST.find(d => d.path === location.pathname);
    return dashboard?.slug || null;
  }, [location.pathname]);

  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!document.fullscreenElement;
    setIsFullscreen(isCurrentlyFullscreen);
    setIsHeaderVisible(!isCurrentlyFullscreen);
    onFullscreenChange?.(isCurrentlyFullscreen);
  }, [onFullscreenChange]);

  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [handleFullscreenChange]);

  // Handle mouse movement for showing/hiding header in fullscreen
  useEffect(() => {
    if (!isFullscreen) {
      setIsHeaderVisible(true);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Show header when mouse is in the top 60px of the screen
      if (e.clientY <= 60) {
        setIsHeaderVisible(true);
      } else if (e.clientY > 100) {
        // Hide when mouse moves below 100px (gives some buffer)
        setIsHeaderVisible(false);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [isFullscreen]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  const handleGoToMenu = () => {
    navigate("/home");
  };

  return (
    <div 
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 pb-4 border-b border-border bg-background transition-all duration-300 ${
        isFullscreen 
          ? `fixed top-0 left-0 right-0 z-50 px-6 py-4 mb-0 ${isHeaderVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}` 
          : ''
      }`}
    >
      {/* Left side - Logo with home button and title */}
      <div className="flex items-center gap-3 min-w-0">
        <img 
          src={cphSalesLogo} 
          alt="CPH Sales" 
          className="h-10 sm:h-12 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
          onClick={handleGoToMenu}
        />
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right side - Screen resolution and buttons */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
        {rightContent}
        
        {!isTvBoardMode && (
          <>
            {/* Dashboard selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden md:inline">Dashboards</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {accessibleDashboards.map((dashboard) => (
                  <DropdownMenuItem
                    key={dashboard.slug}
                    onClick={() => navigate(dashboard.path)}
                    className={location.pathname === dashboard.path ? "bg-accent" : ""}
                  >
                    {dashboard.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* TV Link Generator */}
            {/* TV Link Generator - only for leadership */}
            {currentDashboardSlug && canCreateTvLink && (
              <TvBoardQuickGenerator dashboardSlug={currentDashboardSlug} />
            )}

            {/* Fullscreen button */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="gap-2"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="hidden md:inline">Afslut</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden md:inline">Fuldskærm</span>
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
