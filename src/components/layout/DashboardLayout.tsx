import { ReactNode, useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { LockOverlays } from "./LockOverlays";
import { RolePreviewBanner } from "./RolePreviewBanner";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SoftphoneWidget } from "@/components/calls/SoftphoneWidget";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isPreviewMode } = useRolePreview();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          <DashboardSidebar />
        </div>
        
        {/* Mobile header with menu trigger */}
        <div className={`md:hidden fixed left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 ${isPreviewMode ? "top-10" : "top-0"}`}>
          <div 
            onClick={() => navigate("/")} 
            className="flex items-center cursor-pointer"
          >
            <img src={cphSalesLogo} alt="CPH Sales" className="h-8 w-auto object-contain" />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Environment Switcher - Mobile */}
            <EnvironmentSwitcher compact />
            
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
        </div>
        
        {/* Desktop Environment Switcher - Fixed position top right */}
        <div className={`hidden md:flex fixed right-4 z-50 ${isPreviewMode ? "top-14" : "top-4"}`}>
          <EnvironmentSwitcher />
        </div>
        
        {/* Main content with sidebar margin on desktop */}
        <main className={`md:ml-64 min-h-screen ${isPreviewMode ? "pt-24 md:pt-10" : "pt-14 md:pt-0"}`}>
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