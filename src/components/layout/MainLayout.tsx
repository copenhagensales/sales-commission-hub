import { ReactNode, useState, createContext, useContext } from "react";
import { AppSidebar } from "./AppSidebar";
import { PreviewSidebar } from "./PreviewSidebar";
import { LockOverlays } from "./LockOverlays";
import { RolePreviewBanner } from "./RolePreviewBanner";
import { CompleteProfileBanner } from "./CompleteProfileBanner";
import { EnvironmentSwitcher } from "./EnvironmentSwitcher";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useNavigate } from "react-router-dom";
import { PendingAbsencePopup } from "@/components/absence/PendingAbsencePopup";
import { SoftphoneWidget } from "@/components/calls/SoftphoneWidget";
import { LeagueAnnouncementPopup } from "@/components/league/LeagueAnnouncementPopup";
import { PulseSurveyPopup } from "@/components/pulse/PulseSurveyPopup";
import { CodeOfConductReminderPopup } from "@/components/code-of-conduct/CodeOfConductReminderPopup";
import { Menu, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { cn } from "@/lib/utils";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Choose sidebar based on preview mode
  const SidebarComponent = isPreviewMode ? PreviewSidebar : AppSidebar;

  const toggle = () => setIsCollapsed(prev => !prev);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggle }}>
      <LockOverlays>
        <div className="min-h-screen bg-background">
          {/* Preview banner at very top */}
          <RolePreviewBanner />
          
          {/* Complete profile banner for new employees */}
          {!isPreviewMode && <CompleteProfileBanner />}
          
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
          
          {/* Mobile header with burger menu */}
          <div className={`md:hidden fixed left-0 right-0 z-50 h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 ${isPreviewMode ? "top-10" : "top-0"}`}>
            <div 
              onClick={() => navigate("/")} 
              className="flex items-center cursor-pointer"
            >
              <img src={cphSalesLogo} alt="CPH Sales" className="h-14 w-auto object-contain" />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Environment Switcher - Mobile */}
              <EnvironmentSwitcher compact />
              
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary h-12 w-12">
                    <Menu className="h-7 w-7" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
                  <SidebarComponent isMobile onNavigate={() => setMobileMenuOpen(false)} />
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          
          {/* Main content with responsive margin */}
          <main className={cn(
            "min-h-screen transition-all duration-300 ease-in-out",
            isCollapsed ? "md:ml-0" : "md:ml-64",
            isPreviewMode ? "pt-26 md:pt-10" : "pt-16 md:pt-0"
          )}>
            <div className="p-4 md:p-8">
              {children}
            </div>
          </main>
          
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