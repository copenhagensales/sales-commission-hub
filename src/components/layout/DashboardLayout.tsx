import { ReactNode, useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { LockOverlays } from "./LockOverlays";
import { RolePreviewBanner } from "./RolePreviewBanner";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useNavigate } from "react-router-dom";
import { Menu, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SoftphoneWidget } from "@/components/calls/SoftphoneWidget";
import { cn } from "@/lib/utils";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isPreviewMode } = useRolePreview();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Detect TV mode - skip all auth-dependent components
  const isTvMode = typeof window !== 'undefined' && 
    (window.location.pathname.startsWith('/t/') || 
     window.location.pathname.startsWith('/tv/') ||
     sessionStorage.getItem('tv_board_code') !== null);

  // In TV mode, render only children without auth wrappers
  if (isTvMode) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  }

  return (
    <LockOverlays>
      <div className="min-h-screen bg-background">
        {/* Preview banner at very top */}
        <RolePreviewBanner />
        
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <DashboardSidebar 
            isCollapsed={isCollapsed} 
            onToggle={() => setIsCollapsed(!isCollapsed)} 
          />
        </div>
        
        {/* Floating toggle button when sidebar is collapsed - Desktop only */}
        {isCollapsed && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className={cn(
              "hidden md:flex fixed left-4 z-50 h-10 w-10 bg-sidebar border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-300 ease-in-out shadow-lg",
              isPreviewMode ? "top-14" : "top-4"
            )}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        
        {/* Mobile header with menu trigger */}
        <div className={`md:hidden fixed left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 ${isPreviewMode ? "top-10" : "top-0"}`}>
          <div 
            onClick={() => navigate("/")} 
            className="flex items-center cursor-pointer"
          >
            <img src={cphSalesLogo} alt="CPH Sales" className="h-8 w-auto object-contain" />
          </div>
          
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary h-12 w-12">
                <Menu className="h-7 w-7" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
              <DashboardSidebar isMobile onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        
        {/* Main content with sidebar margin on desktop */}
        <main className={cn(
          "min-h-screen transition-all duration-300 ease-in-out",
          isCollapsed ? "md:ml-0" : "md:ml-64",
          isPreviewMode ? "pt-24 md:pt-10" : "pt-14 md:pt-0"
        )}>
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
        
        {/* Softphone Widget */}
        <SoftphoneWidget />
      </div>
    </LockOverlays>
  );
}
