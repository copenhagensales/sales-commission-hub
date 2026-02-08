import { useAppMode } from "@/contexts/AppModeContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Home, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnvironmentSwitcherProps {
  className?: string;
  compact?: boolean;
}

export function EnvironmentSwitcher({ className, compact = false }: EnvironmentSwitcherProps) {
  const { mode, switchToMain, switchToDashboard, canAccessDashboards, canAccessMainSystem } = useAppMode();
  
  // Don't show switcher if user only has access to one environment
  if (!canAccessDashboards || !canAccessMainSystem) {
    return null;
  }
  
  const isMainMode = mode === "main";
  
  if (compact) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={isMainMode ? switchToDashboard : switchToMain}
        className={cn(
          "h-9 w-9 shrink-0 bg-sidebar-accent/50 hover:bg-primary hover:text-primary-foreground border-sidebar-border transition-all duration-200",
          className
        )}
        title={isMainMode ? "Gå til Dashboards" : "Gå til Hovedsystem"}
      >
        <LayoutDashboard className="h-4 w-4" />
      </Button>
    );
  }
  
  return (
    <div className={cn("flex items-center gap-1 p-1 rounded-lg bg-muted", className)}>
      <Button
        variant={isMainMode ? "default" : "ghost"}
        size="sm"
        onClick={switchToMain}
        className={cn(
          "gap-2 transition-all",
          isMainMode ? "shadow-sm" : "hover:bg-background/50"
        )}
      >
        <Home className="h-4 w-4" />
        <span className="hidden md:inline">Hovedsystem</span>
      </Button>
      <Button
        variant={!isMainMode ? "default" : "ghost"}
        size="sm"
        onClick={switchToDashboard}
        className={cn(
          "gap-2 transition-all",
          !isMainMode ? "shadow-sm" : "hover:bg-background/50"
        )}
      >
        <LayoutDashboard className="h-4 w-4" />
        <span className="hidden md:inline">Dashboards</span>
      </Button>
    </div>
  );
}
