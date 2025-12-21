import { useState, useEffect, useCallback, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, LayoutGrid, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScreenResolutionIndicator } from "./ScreenResolutionIndicator";
import { DASHBOARD_LIST } from "@/config/dashboards";
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreenChange = useCallback(() => {
    const isCurrentlyFullscreen = !!document.fullscreenElement;
    setIsFullscreen(isCurrentlyFullscreen);
    onFullscreenChange?.(isCurrentlyFullscreen);
  }, [onFullscreenChange]);

  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [handleFullscreenChange]);

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
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
      {/* Left side - Logo and title */}
      <div className="flex items-center gap-4">
        <img 
          src={cphSalesLogo} 
          alt="CPH Sales" 
          className="h-10 w-auto object-contain cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleGoToMenu}
        />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right side - Screen resolution and buttons */}
      <div className="flex items-center gap-2 md:gap-3">
        {rightContent}
        
        <ScreenResolutionIndicator />
        
        {/* Go to menu button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoToMenu}
          className="gap-2"
        >
          <Menu className="h-4 w-4" />
          <span className="hidden md:inline">Gå til menu</span>
        </Button>

        {/* Dashboard selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden md:inline">Dashboards</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {DASHBOARD_LIST.map((dashboard) => (
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
      </div>
    </div>
  );
}
