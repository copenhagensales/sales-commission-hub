import { ReactNode, useState } from "react";
import { DashboardSidebar } from "./DashboardSidebar";
import { LockOverlays } from "./LockOverlays";
import { RolePreviewBanner } from "./RolePreviewBanner";
import { ViewAsBanner } from "./ViewAsBanner";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useLocation, useNavigate } from "react-router-dom";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SoftphoneWidget } from "@/components/calls/SoftphoneWidget";
import { cn } from "@/lib/utils";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { isTvMode } from "@/utils/tvMode";
import { LayoutNestingContext, useIsInsideLayout } from "./LayoutNesting";
import { PageShell, DraftGuardNavigationListener, useBottomTabs, useIsPhone } from "@/components/mobile";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isPreviewMode } = useRolePreview();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { pathname } = useLocation();
  const tabs = useBottomTabs();
  const isTabRoot = tabs.some((t) => t.to.split("?")[0] === pathname);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Detect TV mode - skip all auth-dependent components
  const tvMode = isTvMode();
  const nested = useIsInsideLayout();

  // Allerede inde i et layout (side brugt som fane i en samleside): kun indholdet.
  if (nested) return <>{children}</>;

  // In TV mode, render only children without auth wrappers
  if (tvMode) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  }

  return (
   <LayoutNestingContext.Provider value={true}>
    <LockOverlays>
      <div className="min-h-[100dvh] bg-background">
        {/* Preview banner at very top */}
        <ViewAsBanner />
        <RolePreviewBanner />
        
        <DraftGuardNavigationListener />
        {isPhone ? (
          /* Telefon (< 768 px): topbjælke + bundnavigation; dashboard-menuen ligger under »Mere«. */
          <PageShell
            title={<img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" onClick={() => navigate("/")} />}
            showBack={!isTabRoot}
            moreMenu={(close) => <DashboardSidebar isMobile onNavigate={close} />}
          >
            <main className="min-w-0 p-4">{children}</main>
          </PageShell>
        ) : (
          <>
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
        
        {/* Main content with sidebar margin on desktop */}
        <main className={cn(
          "min-h-[100dvh] transition-all duration-300 ease-in-out",
          isCollapsed ? "md:ml-0" : "md:ml-64",
          isPreviewMode ? "pt-10" : "pt-0"
        )}>
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
        
          </>
        )}

        {/* Softphone Widget */}
        <SoftphoneWidget />
      </div>
    </LockOverlays>
   </LayoutNestingContext.Provider>
  );
}
