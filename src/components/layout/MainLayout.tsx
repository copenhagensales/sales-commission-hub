import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { ContractLockOverlay } from "./ContractLockOverlay";
import { CarQuizLockOverlay } from "./CarQuizLockOverlay";
import { usePendingContractLock } from "@/hooks/usePendingContractLock";
import { useCarQuizLock } from "@/hooks/useCarQuiz";
import { useLocation } from "react-router-dom";
import { PendingAbsencePopup } from "@/components/absence/PendingAbsencePopup";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isLocked: isContractLocked, contract } = usePendingContractLock();
  const { isLocked: isQuizLocked } = useCarQuizLock();
  const location = useLocation();

  // Don't show car quiz lock if we're already on the car-quiz page
  const showQuizLock = isQuizLocked && location.pathname !== "/car-quiz";

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
      <AppSidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
      
      {/* Popup for pending absence requests - shown to team leaders */}
      <PendingAbsencePopup />
    </div>
  );
}
