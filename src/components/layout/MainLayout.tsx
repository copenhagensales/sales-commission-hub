import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { ContractLockOverlay } from "./ContractLockOverlay";
import { CarQuizLockOverlay } from "./CarQuizLockOverlay";
import { usePendingContractLock } from "@/hooks/usePendingContractLock";
import { useCarQuizLock } from "@/hooks/useCarQuiz";
import { useLocation, useNavigate } from "react-router-dom";
import { PendingAbsencePopup } from "@/components/absence/PendingAbsencePopup";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isLocked: isContractLocked, contract, isLoading: contractLoading } = usePendingContractLock();
  const { isLocked: isQuizLocked, isLoading: quizLoading } = useCarQuizLock();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Don't show car quiz lock if we're already on the car-quiz page
  const showQuizLock = isQuizLocked && location.pathname !== "/car-quiz";

  // Show loading state while checking locks
  if (contractLoading || quizLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {isContractLocked && contract && (
        <ContractLockOverlay 
          contractId={contract.id} 
          contractTitle={contract.title} 
        />
      )}
      {showQuizLock && !isContractLocked && (
        <CarQuizLockOverlay />
      )}
      
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>
      
      {/* Mobile header with burger menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
        <div 
          onClick={() => navigate("/")} 
          className="flex items-center cursor-pointer"
        >
          <img src={cphSalesLogo} alt="CPH Sales" className="h-8 w-auto object-contain" />
        </div>
        
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <AppSidebar isMobile onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
      
      {/* Main content with responsive margin */}
      <main className="md:ml-64 min-h-screen pt-14 md:pt-0">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
      
      {/* Popup for pending absence requests - shown to team leaders */}
      <PendingAbsencePopup />
    </div>
  );
}
