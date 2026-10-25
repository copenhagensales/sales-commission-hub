import { ReactNode, useState, createContext, useContext } from "react";
import { AppSidebar } from "./AppSidebar";
import { PreviewSidebar } from "./PreviewSidebar";
import { LockOverlays } from "./LockOverlays";
import { RolePreviewBanner } from "./RolePreviewBanner";
import { ViewAsBanner } from "./ViewAsBanner";
import { CompleteProfileBanner } from "./CompleteProfileBanner";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useLocation, useNavigate } from "react-router-dom";
import { PendingAbsencePopup } from "@/components/absence/PendingAbsencePopup";
import { SoftphoneWidget } from "@/components/calls/SoftphoneWidget";
import { LeagueAnnouncementPopup } from "@/components/league/LeagueAnnouncementPopup";
import { PulseSurveyPopup } from "@/components/pulse/PulseSurveyPopup";
import { CodeOfConductReminderPopup } from "@/components/code-of-conduct/CodeOfConductReminderPopup";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { cn } from "@/lib/utils";
import { PageShell, DraftGuardNavigationListener, useBottomTabs, useIsPhone } from "@/components/mobile";

// Context for sidebar state
interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarState must be used within MainLayout");
  }
  return context;
}

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isPreviewMode } = useRolePreview();
  const navigate = useNavigate();
  const isPhone = useIsPhone();
  const { pathname } = useLocation();
  const tabs = useBottomTabs();
  const isTabRoot = tabs.some((t) => t.to === pathname) || pathname === "/";
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Choose sidebar based on preview mode
  const SidebarComponent = isPreviewMode ? PreviewSidebar : AppSidebar;

  const toggle = () => setIsCollapsed(prev => !prev);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggle }}>
      <LockOverlays>
        <div className="min-h-[100dvh] bg-background">
          {/* Preview banner at very top */}
          <ViewAsBanner />
          <RolePreviewBanner />
          
          {/* Complete profile banner for new employees */}
          {!isPreviewMode && !isPhone && <CompleteProfileBanner />}
          
          <DraftGuardNavigationListener />
          {isPhone ? (
            /* Telefon (< 768 px): topbjælke + bundnavigation; den gamle menu ligger under »Mere«. */
            <PageShell
              title={<img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" onClick={() => navigate("/")} />}
              showBack={!isTabRoot}
              right={<EnvironmentSwitcher compact />}
              moreMenu={(close) => <SidebarComponent isMobile onNavigate={close} />}
            >
              <main className="min-w-0 p-4">
                {!isPreviewMode && <div className="mb-4 empty:hidden"><CompleteProfileBanner /></div>}
                {children}
              </main>
            </PageShell>
          ) : (
            <>
          {/* Desktop sidebar */}
          <div className="hidden md:block">
            <SidebarComponent isCollapsed={isCollapsed} onToggle={toggle} />
          </div>
          
          {/* Collapsed sidebar toggle button - visible when sidebar is collapsed */}
          {isCollapsed && (
            <div className="hidden md:flex fixed top-4 left-4 z-50 items-center gap-2 animate-fade-in">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="h-10 w-10 bg-sidebar/95 backdrop-blur-sm border border-sidebar-border shadow-lg hover:bg-sidebar-accent transition-all duration-300"
              >
                <PanelLeft className="h-5 w-5 text-sidebar-foreground" />
              </Button>
              <EnvironmentSwitcher compact />
            </div>
          )}
          
          {/* Main content with responsive margin */}
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

          {/* Popup for pending absence requests - shown to team leaders (skip in preview mode) */}
          {!isPreviewMode && <PendingAbsencePopup />}
          
          {/* League announcement popup - shown once to non-enrolled users */}
          {!isPreviewMode && <LeagueAnnouncementPopup />}
          
          {/* Pulse survey popup - monthly anonymous survey for non-staff employees */}
          {!isPreviewMode && <PulseSurveyPopup />}

          {/* Code of Conduct reminder popup - shown when admin has sent a reminder */}
          {!isPreviewMode && <CodeOfConductReminderPopup />}
          
          {/* Softphone Widget */}
          <SoftphoneWidget />
        </div>
      </LockOverlays>
    </SidebarContext.Provider>
  );
}