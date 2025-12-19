import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { PreviewSidebar } from "./PreviewSidebar";
import { ContractLockOverlay } from "./ContractLockOverlay";
import { CarQuizLockOverlay } from "./CarQuizLockOverlay";
import { RolePreviewBanner } from "./RolePreviewBanner";
import { usePendingContractLock } from "@/hooks/usePendingContractLock";
import { useCarQuizLock } from "@/hooks/useCarQuiz";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useLocation, useNavigate } from "react-router-dom";
import { PendingAbsencePopup } from "@/components/absence/PendingAbsencePopup";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isLocked: isContractLocked, contract, isLoading: contractLoading } = usePendingContractLock();
  const { isLocked: isQuizLocked, isLoading: quizLoading } = useCarQuizLock();
  const { isPreviewMode } = useRolePreview();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show car quiz lock if we're already on the car-quiz page
  const showQuizLock = isQuizLocked && location.pathname !== "/car-quiz";

  // Skip locks in preview mode
  const showContractLock = isContractLocked && !isPreviewMode;
  const showCarQuizLock = showQuizLock && !isContractLocked && !isPreviewMode;

  // Show loading state while checking locks (skip in preview mode)
  if ((contractLoading || quizLoading) && !isPreviewMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }

  // Choose sidebar based on preview mode
  const SidebarComponent = isPreviewMode ? PreviewSidebar : AppSidebar;

  return (
    <div className="min-h-screen bg-background">
      {/* Preview banner at very top */}
      <RolePreviewBanner />
      
      {showContractLock && contract && (
        <ContractLockOverlay 
          contractId={contract.id} 
          contractTitle={contract.title} 
        />
      )}
      {showCarQuizLock && (
        <CarQuizLockOverlay />
      )}
      
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <SidebarComponent />
      </div>
      
      {/* Mobile header with burger menu */}
      <div className={`md:hidden fixed left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 ${isPreviewMode ? "top-10" : "top-0"}`}>
        <div 
          onClick={() => navigate("/")} 
          className="flex items-center cursor-pointer"
        >
          <img src={cphSalesLogo} alt="CPH Sales" className="h-8 w-auto object-contain" />
        </div>
        
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <SidebarComponent isMobile onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Main content with responsive margin */}
      <main className={`md:ml-64 min-h-screen ${isPreviewMode ? "pt-24 md:pt-10" : "pt-14 md:pt-0"}`}>
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
      
      {/* Popup for pending absence requests - shown to team leaders (skip in preview mode) */}
      {!isPreviewMode && <PendingAbsencePopup />}
    </div>
  );
}
