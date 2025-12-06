import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { ContractLockOverlay } from "./ContractLockOverlay";
import { CarQuizLockOverlay } from "./CarQuizLockOverlay";
import { CodeOfConductLockOverlay } from "./CodeOfConductLockOverlay";
import { usePendingContractLock } from "@/hooks/usePendingContractLock";
import { useCarQuizLock } from "@/hooks/useCarQuiz";
import { useCodeOfConductLock } from "@/hooks/useCodeOfConduct";
import { useLocation } from "react-router-dom";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isLocked: isContractLocked, contract } = usePendingContractLock();
  const { isLocked: isQuizLocked } = useCarQuizLock();
  const { isLocked: isCodeOfConductLocked } = useCodeOfConductLock();
  const location = useLocation();

  // Don't show car quiz lock if we're already on the car-quiz page
  const showQuizLock = isQuizLocked && location.pathname !== "/car-quiz";
  // Don't show code of conduct lock if we're already on the code-of-conduct page
  const showCodeOfConductLock = isCodeOfConductLocked && location.pathname !== "/code-of-conduct";

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
      {showCodeOfConductLock && !isContractLocked && !showQuizLock && (
        <CodeOfConductLockOverlay />
      )}
      <AppSidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
